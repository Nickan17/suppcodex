import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { toGrade } from './toGrade';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file or app.config.ts');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add at top (below imports)
const cap = (s: string, n = 3000) => (s?.length ? s.slice(0, n) : '');
const stripHtmlToText = (html: string) =>
  html
    ?.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';

/** Count supplement facts tokens in text. */
function tokenScore(s: string): number {
  if (!s) return 0;
  return ((s || '').match(/(serving size|amount per serving|% dv|calories|protein|mg|mcg|iu|supplement\s+facts|nutrition\s+facts)/gi) || []).length;
}

/** Check if text contains review/FAQ/marketing content markers. */
function isReviewOrFaqContent(s: string): boolean {
  const lower = s.toLowerCase();
  const markers = ['review', 'faq', 'question', 'customer', 'q&a', 'testimonial', 'rating'];
  return markers.some(marker => {
    const index = lower.indexOf(marker);
    if (index === -1) return false;
    // Check if marker appears in a significant portion of the text
    const context = lower.substring(Math.max(0, index - 50), index + 50);
    return context.includes(marker);
  });
}

export type ScorePayload = {
  score: number;                // 1..100
  highlights: string[];         // <= 5 items
  concerns: string[];           // <= 5 items
  _meta?: Record<string, any>;
};

export type ExtractPayload = {
  title?: string;
  ingredients?: string[];
  supplementFacts?: { raw?: string } | null;
  warnings?: string[];
  raw?: {
    success?: boolean;
    data?: {
      markdown?: string;
      html?: string;
      metadata?: Record<string, any>;
    };
  } | null;
  _meta?: Record<string, any>;
};

export type ChainResult = {
  product: {
    title: string;
    ingredients: string[];
    facts: string;         // from supplementFacts.raw
    warnings: string[];
  };
  score: ScorePayload;     // normalized (clamped int, arrays)
  meta: {
    extract?: any;
    score?: any;
    chain?: any[];
    ts: number;
  };
};

/**
 * Resilient chain that always returns a valid ChainResult
 */
export async function chainExtractToScore(url: string): Promise<ChainResult> {
  const startTime = Date.now();
  
  // Default result structure
  const result: ChainResult = {
    product: {
      title: 'Unknown Product',
      ingredients: [],
      facts: '',
      warnings: []
    },
    score: {
      score: 0,
      highlights: [],
      concerns: []
    },
    meta: {
      ts: startTime,
      chain: []
    }
  };

  if (__DEV__) console.log('[chain] Starting extraction for:', url);

  // Helper to track chain steps for complete traceability
  const addChainStep = (provider: string, status: 'ok' | 'error' | 'empty', ms: number, error?: string) => {
    const step = {
      provider,
      status,
      ms,
      ...(error && { error }),
      timestamp: new Date().toISOString()
    };
    result.meta.chain = result.meta.chain || [];
    result.meta.chain.push(step);
    if (__DEV__) console.log(`[chain] ${provider}:`, step);
  };

  try {
    // Step 1: Extract content with firecrawl
    const extractStart = Date.now();
    const extractRes = await supabase.functions.invoke('firecrawl-extract', {
      body: { url },
    });
    const extractMs = Date.now() - extractStart;

    if (__DEV__) console.log('[chain] Extract response:', extractRes);

    // Handle extract errors or non-200
    const extractOk =
      !extractRes.error &&
      (extractRes.data != null || extractRes.response?.ok === true);

    if (!extractOk) {
      addChainStep('firecrawl-extract', 'error', extractMs, extractRes.error || 'Extract not ok');
      result.meta.extract = {
        error: extractRes.error || `Extract not ok`,
        httpOk: extractRes.response?.ok ?? null
      };
      if (__DEV__) console.log('[chain] Extract failed, returning default result');
      return result;
    }

    addChainStep('firecrawl-extract', 'ok', extractMs);

    const extractData: ExtractPayload = extractRes.data || {};

    // Update product data from extract
    result.product = {
      title: extractData.title || 'Unknown Product',
      ingredients: Array.isArray(extractData.ingredients) ? extractData.ingredients : [],
      facts: extractData.supplementFacts?.raw || '',
      warnings: Array.isArray(extractData.warnings) ? extractData.warnings : []
    };

    // Facts-first approach: prefer clean supplement facts, exclude reviews/FAQ
    const raw = (extractData as any)?.raw; // may include data.markdown/html
    const sfRaw = typeof extractData?.supplementFacts?.raw === 'string' ? extractData.supplementFacts.raw : '';
    const md = typeof raw?.data?.markdown === 'string' ? raw.data.markdown : '';
    const html = typeof raw?.data?.html === 'string' ? raw.data.html : '';
    const htmlText = html ? stripHtmlToText(html) : '';

    let factsForScoring = '';
    let factsSource = 'none';
    let factsTokens = 0;
    
    // Priority 1: supplementFacts.raw (if token count >= 2)
    if (sfRaw && tokenScore(sfRaw) >= 2 && !isReviewOrFaqContent(sfRaw)) {
      factsForScoring = sfRaw;
      factsSource = 'supplement_facts';
      factsTokens = tokenScore(sfRaw);
    }
    // Priority 2: raw markdown (if clean and token count >= 2)
    else if (md && tokenScore(md) >= 2 && !isReviewOrFaqContent(md)) {
      factsForScoring = md;
      factsSource = 'markdown';
      factsTokens = tokenScore(md);
    }
    // Priority 3: raw HTML stripped (if clean and token count >= 2)
    else if (htmlText && tokenScore(htmlText) >= 2 && !isReviewOrFaqContent(htmlText)) {
      factsForScoring = htmlText;
      factsSource = 'html';
      factsTokens = tokenScore(htmlText);
    }
    // Priority 4: ingredients only (as last resort)
    else if (extractData?.ingredients?.length) {
      factsForScoring = `Ingredients: ${(extractData.ingredients).join(', ')}`;
      factsSource = 'ingredients';
      factsTokens = 0; // Ingredients don't have supplement facts tokens
    }
    
    // Cap length and ensure we don't send review/FAQ content
    factsForScoring = cap(factsForScoring, 3000);
    
    // Add metadata for tracking
    result.meta.factsSource = factsSource;
    result.meta.factsTokens = factsTokens;
    result.meta.extractWasWeak = factsTokens < 2 && factsSource !== 'ingredients';

    if (__DEV__) {
      console.log('[chain] Extract OK. title:', result.product.title);
      console.log('[chain] factsSource:', factsSource);
      console.log('[chain] factsTokens:', factsTokens);
      console.log('[chain] factsForScoring length:', factsForScoring.length);
      console.log('[chain] extractWasWeak:', result.meta.extractWasWeak);
    }

    // Extract metadata from extractor response
    const extractMeta = extractData._meta || {};
    const facts_kind = extractMeta.facts_kind || 'ingredients_only';
    const numeric_doses_present = extractMeta.had_numeric_doses || false;
    const ingredients_source = extractMeta.ingredients_source || 'html';
    
    // Determine product type hint
    let product_type_hint = 'supplement';
    if (result.product.title && /protein|whey|isolate|casein/i.test(result.product.title)) {
      product_type_hint = 'protein';
    } else if (factsForScoring && /protein.*\d+.*g/i.test(factsForScoring)) {
      product_type_hint = 'protein';
    }

    // When calling the scorer, always send { facts } (not supplementFacts):
    const scoreBody = {
      title: result.product.title,
      ingredients: result.product.ingredients,
      facts: factsForScoring,
      warnings: result.product.warnings,
      _meta: {
        facts_kind,
        numeric_doses_present,
        ingredients_source,
        product_type_hint
      }
    };

    const scoreStart = Date.now();
    const scoreRes = await supabase.functions.invoke('score-supplement', {
      body: scoreBody
    });
    const scoreMs = Date.now() - scoreStart;

    if (__DEV__) console.log('[chain] Score response:', scoreRes);

    // Parse scorer response safely
    const scoreOk = !scoreRes.error && (scoreRes.data != null || scoreRes.response?.ok === true);
    
    if (scoreOk) {
      addChainStep('score-supplement', 'ok', scoreMs);
      
      const raw = scoreRes.data;
      let s: any = {};
      
      if (typeof raw === 'string') {
        try { 
          s = JSON.parse(raw); 
        } catch { 
          s = {}; 
        }
      } else {
        s = raw;
      }

      // Normalize score data with explicit type guards - allow 0 for truly unanalyzable products
      const rawScore = typeof s.score === 'number' ? s.score : (typeof s.score === 'string' ? parseFloat(s.score) : NaN);
      const scoreNum = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
      const highlights = Array.isArray(s.highlights) 
        ? s.highlights.filter(item => typeof item === 'string' && item.trim()).slice(0, 5) 
        : [];
      const concerns = Array.isArray(s.concerns) 
        ? s.concerns.filter(item => typeof item === 'string' && item.trim()).slice(0, 5) 
        : [];

      // Client-side concern adjustment for ingredients vs dosages
      let adjustedConcerns = [...concerns];
      
      // If we have ingredients but no numeric dosages, adjust concern messaging
      if (result.product.ingredients.length > 0 && !numeric_doses_present) {
        // Remove any "no ingredients" concerns and replace with dosage concern if needed
        adjustedConcerns = adjustedConcerns.filter(c => 
          !c.toLowerCase().includes('ingredient list') && 
          !c.toLowerCase().includes('no ingredients')
        );
        
        // Add dosage concern if not already present and if it's a nutrition facts panel
        const hasDosageConcern = adjustedConcerns.some(c => 
          c.toLowerCase().includes('dosage') || c.toLowerCase().includes('per-ingredient')
        );
        
        if (!hasDosageConcern && facts_kind === 'nutrition_facts') {
          adjustedConcerns.unshift('No per-ingredient dosages disclosed');
        }
      }
      
      result.score = {
        score: scoreNum,
        highlights,
        concerns: adjustedConcerns.slice(0, 5), // Keep max 5 concerns
        _meta: s._meta
      };

      result.meta.score = s._meta;

      if (__DEV__) console.log('[chain] Score parsed successfully:', { score: scoreNum, highlights, concerns });
    } else {
      addChainStep('score-supplement', 'error', scoreMs, scoreRes.error || 'Score not ok');
      
      // Score failed but we still have product data
      result.meta.score = {
        error: scoreRes.error || `Score not ok`,
        httpOk: scoreRes.response?.ok ?? null
      };
      
      if (__DEV__) console.log('[chain] Score failed, using defaults');
    }

  } catch (error: any) {
    console.error('[chain] Unexpected error:', error);
    result.meta.error = error.message || String(error);
  }

  // If we reached scorer, even with weak facts, do not imply 'service unavailable'.
  // The UI should show that banner ONLY when meta.score?.error is present.

  result.meta.ts = Date.now() - startTime;

  if (__DEV__) {
    console.log('[chain] Final result:', {
      product: result.product,
      score: { score: result.score.score, highlights: result.score.highlights, concerns: result.score.concerns }
    });
  }

  return result;
}