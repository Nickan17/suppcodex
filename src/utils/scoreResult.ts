import { cleanProductTitle, deriveTitleFromUrl, looksLikeReviewNoise } from './cleanProductTitle';

export type CertBadge = 'Non-GMO' | 'Gluten-Free' | 'Vegan' | 'Soy-Free' | 'Dairy-Free' | 'Keto';
export type DataQuality = 'good' | 'partial' | 'ocr-only';

export interface LabelMeta {
  factsSource?: 'html' | 'ocr' | 'ld-json' | 'table' | 'none';
  factsTokens?: number;
  servingSize?: string | null;
  productType?: 'protein' | 'preworkout' | 'vitamin' | 'other';
}

export interface NormalizedScore {
  displayTitle: string;
  score: number; purity: number; effectiveness: number; safety: number; value: number;
  highlights: string[]; concerns: string[];
  ingredients: string[];
  certifications: CertBadge[];
  meta?: LabelMeta & { title_source?: string; pageTitleRaw?: string | null; requestUrl?: string | null };
  dataQuality: DataQuality;
  scoringVersion: string;
  rubric: {
    purity: string[];
    effectiveness: string[];
    safety: string[];
    value: string[];
  };
}

// naive badge detection
const BADGE_PATTERNS: Record<CertBadge, RegExp> = {
  'Non-GMO': /\bnon[-\s]?gmo\b/i,
  'Gluten-Free': /\bgluten[-\s]?free\b/i,
  'Vegan': /\bvegan\b/i,
  'Soy-Free': /\bsoy[-\s]?free\b/i,
  'Dairy-Free': /\bdairy[-\s]?free\b/i,
  'Keto': /\bketo\b/i
};

function detectCerts(texts: string[]): CertBadge[] {
  const joined = texts.join(' ').toLowerCase();
  return (Object.keys(BADGE_PATTERNS) as CertBadge[]).filter(k => BADGE_PATTERNS[k].test(joined));
}

// --- INGREDIENTS NORMALIZATION HELPERS ---

type ExtractIn = {
  title?: string | null;
  ingredients?: string[] | string | null;
  supplementFacts?: { raw?: string | null } | null;
  facts?: string | null;
  _meta?: { factsSource?: string; factsTokens?: number; servingSize?: string | null; productType?: LabelMeta['productType']; ingredients_source?: string; requestUrl?: string | null; pageTitle?: string | null; pageTitleRaw?: string | null; titleSource?: string | null };
};

const ING_PREFIX = /^ingredients?\s*:\s*/i;
const SPLIT_RE = /[,;•\n]+/g;

/** Accept array or string; keep short-but-real items like "Salt". */
export function normalizeIngredients(input?: string[] | string | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    const cleaned = input
      .map(s => (s ?? '').toString().replace(ING_PREFIX, '').trim())
      .filter(Boolean)
      .map(s => s.replace(/\s+/g, ' '));
    const seen: { [key: string]: true } = {};
    const deduped: string[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      const item = cleaned[i];
      const key = item.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        deduped.push(item);
      }
    }
    return deduped;
  }
  // string
  const s = input.toString().replace(ING_PREFIX, '').trim();
  if (!s) return [];
  const parts = s
    .split(SPLIT_RE)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => x.replace(/\s+/g, ' '));
  const seen: { [key: string]: true } = {};
  const deduped: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const item = parts[i];
    const key = item.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      deduped.push(item);
    }
  }
  return deduped;
}

/** Fallback from facts text if ingredients[] is empty. Single-line grab. */
export function fallbackIngredientsFromFacts(facts?: string | null): string[] {
  if (!facts) return [];
  const m = facts.match(/ingredients?\s*:\s*([^\n]+)/i);
  if (!m) return [];
  return normalizeIngredients(m[0]); // let normalize split & dedupe
}

function resolveDisplayTitle(extract: ExtractIn): string {
  const raw = (extract.title || '').trim() || (extract._meta?.pageTitleRaw || extract._meta?.pageTitle || '').trim() || '';
  let candidate = cleanProductTitle(raw, { url: extract._meta?.requestUrl || (extract as any)?._meta?.url || null, pageTitleRaw: extract._meta?.pageTitleRaw || null, max: 80 });
  if (!candidate || looksLikeReviewNoise(candidate)) {
    candidate = cleanProductTitle('', { url: extract._meta?.requestUrl || (extract as any)?._meta?.url || null, pageTitleRaw: extract._meta?.pageTitleRaw || null, max: 80 }) || 'Product';
  }
  return candidate;
}

export function mapExtractAndScoreToNormalized(input: {
  extract: ExtractIn;
  score: {
    score?: number; purity?: number; effectiveness?: number; safety?: number; value?: number;
    highlights?: string[]; concerns?: string[];
  };
}): NormalizedScore {
  const displayTitle = resolveDisplayTitle(input.extract);

  // --- ingredients first
  let ingredients = normalizeIngredients(input.extract.ingredients ?? null);
  if (ingredients.length === 0) {
    const factsStr = input.extract.supplementFacts?.raw ?? input.extract.facts ?? '';
    ingredients = fallbackIngredientsFromFacts(factsStr);
  }

  const factsSource = (input.extract._meta?.factsSource as LabelMeta['factsSource']) ?? 'none';
  const factsTokens = input.extract._meta?.factsTokens ?? 0;
  const servingSize = input.extract._meta?.servingSize ?? null;
  const productType = input.extract._meta?.productType ?? 'other';

  // Data quality
  const dataQuality: DataQuality =
    factsSource === 'ocr' && factsTokens >= 2 && ingredients.length < 3 ? 'ocr-only'
    : (factsTokens >= 2 && ingredients.length >= 3 ? 'good' : 'partial');

  // Certifications: run detector on final ingredients array
  const certs = detectCerts(ingredients);

  // Rubric bullets
  const purityBullets: string[] = [];
  if (ingredients.some(i => /sucralose|acesulfame|aspartame/i.test(i))) purityBullets.push('Contains artificial sweeteners');
  if (ingredients.some(i => /xanthan|gum|carrageenan/i.test(i))) purityBullets.push('Includes gums/thickeners');
  if (ingredients.some(i => /natural.*flavor|artificial.*flavor/i.test(i))) purityBullets.push('Uses flavor additives');
  if (purityBullets.length === 0) purityBullets.push('Label appears relatively clean');

  const effectivenessBullets: string[] = [];
  if (productType === 'protein') {
    if (ingredients.some(i => /whey.*isolate|milk protein isolate/i.test(i))) effectivenessBullets.push('High-quality protein sources');
    effectivenessBullets.push('Effectiveness reflects protein quality/transparency');
  } else {
    effectivenessBullets.push('Per-ingredient dosages undisclosed');
  }

  const safetyBullets: string[] = [];
  if (ingredients.some(i => /allergen|milk|soy|egg|wheat|peanut|tree nut/i.test(i))) safetyBullets.push('Allergens present');
  if (ingredients.some(i => /proprietary blend/i.test(i))) safetyBullets.push('Proprietary blend reduces transparency');
  if (safetyBullets.length === 0) safetyBullets.push('No major safety flags detected from label');

  const valueBullets: string[] = ['Value is a placeholder until pricing is wired'];

  // clamp score fields, tolerant of undefined
  const clamp = (n: number | undefined) => clamp100(typeof n === 'number' ? n : 0);

  return {
    displayTitle,
    score: clamp(input.score.score),
    purity: clamp(input.score.purity),
    effectiveness: clamp(input.score.effectiveness),
    safety: clamp(input.score.safety),
    value: clamp(input.score.value),
    highlights: (input.score.highlights || []).slice(0, 5),
    concerns: (input.score.concerns || []).slice(0, 5),
    ingredients,
    certifications: certs,
    meta: {
      factsSource,
      factsTokens,
      servingSize,
      productType,
      title_source: input.extract._meta?.titleSource || 'normalized',
      pageTitleRaw: input.extract._meta?.pageTitleRaw || null,
      requestUrl: input.extract._meta?.requestUrl || null,
    },
    dataQuality,
    scoringVersion: '1.2.0',
    rubric: {
      purity: purityBullets,
      effectiveness: effectivenessBullets,
      safety: safetyBullets,
      value: valueBullets
    }
  };
}

function clamp100(n: number): number {
  const v = Math.round(typeof n === 'number' && isFinite(n) ? n : 0);
  return Math.max(0, Math.min(100, v));
}