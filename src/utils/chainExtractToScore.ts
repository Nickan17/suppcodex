import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { toGrade } from './toGrade';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// Cache configuration
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_PREFIX = 'chainExtractToScore_';

// Rate limiting configuration
const RATE_LIMIT = 5; // 5 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// In-memory token bucket for rate limiting
let tokenBucket = {
  tokens: RATE_LIMIT,
  lastRefill: Date.now()
};

// Supabase client is imported from lib/supabase with proper configuration

// Add at top (below imports)
const cap = (s: string, n = 3000) => (s?.length ? s.slice(0, n) : '');
const stripHtmlToText = (html: string) =>
  html
    ?.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';

/**
 * Generate SHA256 hash for cache key
 */
function generateCacheKey(url: string): string {
  const hash = CryptoJS.SHA256(url).toString(CryptoJS.enc.Hex);
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Check and update token bucket for rate limiting
 */
function checkRateLimit(): void {
  const now = Date.now();
  const timeSinceLastRefill = now - tokenBucket.lastRefill;
  
  // Refill tokens if a minute has passed
  if (timeSinceLastRefill >= RATE_LIMIT_WINDOW_MS) {
    tokenBucket.tokens = RATE_LIMIT;
    tokenBucket.lastRefill = now;
  }
  
  // Check if we have tokens available
  if (tokenBucket.tokens <= 0) {
    throw new RateLimitError('Rate limit exceeded. Please wait a minute.');
  }
  
  // Consume a token
  tokenBucket.tokens--;
}

/**
 * Get cached result if available and not expired
 */
async function getCachedResult(url: string): Promise<ChainResult | null> {
  try {
    const cacheKey = generateCacheKey(url);
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedData) {
      return null;
    }
    
    const cached: CachedResult = JSON.parse(cachedData);
    const now = Date.now();
    
    // Check if cache has expired
    if (now - cached.timestamp > CACHE_TTL_MS) {
      // Remove expired cache entry
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }
    
    // Mark result as cached
    cached.data.meta.cached = true;
    
    if (__DEV__) {
      console.log('[cache] Cache hit for URL:', url);
      console.log('[cache] Cached data age:', Math.round((now - cached.timestamp) / 1000 / 60), 'minutes');
    }
    
    return cached.data;
  } catch (error) {
    if (__DEV__) {
      console.warn('[cache] Error reading from cache:', error);
    }
    return null;
  }
}

/**
 * Store result in cache
 */
async function setCachedResult(url: string, result: ChainResult): Promise<void> {
  try {
    const cacheKey = generateCacheKey(url);
    const cacheData: CachedResult = {
      data: result,
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    
    if (__DEV__) {
      console.log('[cache] Stored result in cache for URL:', url);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[cache] Error storing to cache:', error);
    }
    // Don't throw - caching is not critical
  }
}

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
    id: string;
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
    cached?: boolean;      // indicates if result came from cache
    factsSource?: string;
    factsTokens?: number;
    extractWasWeak?: boolean;
    error?: string;
  };
  // Legacy compatibility
  success?: boolean;
  parsed?: any;
  error?: any;
  _meta?: any;
};

// Cache-related types
type CachedResult = {
  data: ChainResult;
  timestamp: number;
};

// Rate limiting error type
export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Resilient chain that always returns a valid ChainResult
 * Now with caching and rate limiting
 */
export async function chainExtractToScore(url: string): Promise<ChainResult> {
  const startTime = Date.now();
  
  if (__DEV__) {
    console.log('[chain] ⏳ Starting chainExtractToScore for:', url);
  }
  
  // Check cache first
  const cachedResult = await getCachedResult(url);
  if (cachedResult) {
    if (__DEV__) {
      console.log('[chain] ✅ Returning cached result for:', url);
    }
    return cachedResult;
  }
  
  // Check rate limit before making network requests
  try {
    checkRateLimit();
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw { error: 'rate_limited', message: error.message };
    }
    throw error;
  }
  
  // Default result structure
  const result: ChainResult = {
    product: {
      id: crypto.randomUUID(),
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
    // Step 1: Extract content with firecrawl (with timeout)
    const extractStart = Date.now();
    if (__DEV__) {
      console.log('[chain] 🔍 Calling firecrawl-extract for:', url);
    }
    
    const extractRes = await Promise.race([
      supabase.functions.invoke('firecrawl-extract', {
        body: { url },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Extract timeout after 30s')), 30000)
      )
    ]);
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
      ...result.product,
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
    if (__DEV__) {
      console.log('[chain] 🎯 Calling score-supplement...');
    }
    
    const scoreRes = await Promise.race([
      supabase.functions.invoke('score-supplement', {
        body: scoreBody
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Score timeout after 30s')), 30000)
      )
    ]);
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
        ? s.highlights.filter((item: any) => typeof item === 'string' && item.trim()).slice(0, 5) 
        : [];
      const concerns = Array.isArray(s.concerns) 
        ? s.concerns.filter((item: any) => typeof item === 'string' && item.trim()).slice(0, 5) 
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
        
        // Add dosage concern if not already present
        const hasDosageConcern = adjustedConcerns.some(c => 
          c.toLowerCase().includes('dosage') || c.toLowerCase().includes('per-ingredient') || 
          c.toLowerCase().includes('missing numeric doses')
        );
        
        if (!hasDosageConcern) {
          if (facts_kind === 'nutrition_facts') {
            adjustedConcerns.unshift('No per-ingredient dosages disclosed');
          } else {
            adjustedConcerns.unshift('⚠ Missing numeric doses (label image only)');
          }
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

  // Cache successful results (those that got at least extract data)
  if (result.product.title !== 'Unknown Product' || result.product.ingredients.length > 0) {
    await setCachedResult(url, result);
  }

  // Add legacy compatibility fields
  result.success = result.product.title !== 'Unknown Product' || result.product.ingredients.length > 0;
  result.parsed = result.product;
  result._meta = result.meta;
  
  // Only set error if there's an actual error in meta
  if (result.meta.error) {
    result.error = { message: result.meta.error };
  }

  return result;
}