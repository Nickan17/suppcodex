import { cleanProductTitle } from './cleanProductTitle';

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
  meta?: LabelMeta;
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

export function mapExtractAndScoreToNormalized(input: {
  extract: {
    title?: string;
    ingredients?: string[];
    supplementFacts?: { raw?: string };
    _meta?: { factsSource?: LabelMeta['factsSource']; factsTokens?: number; servingSize?: string | null; productType?: LabelMeta['productType'] };
  };
  score: {
    score: number; purity: number; effectiveness: number; safety: number; value: number;
    highlights: string[]; concerns: string[];
  };
}): NormalizedScore {
  const displayTitle = cleanProductTitle(input.extract.title);
  const ingredients = (input.extract.ingredients || []).map(s => s.trim()).filter(Boolean);
  const factsSource = input.extract._meta?.factsSource ?? 'none';
  const factsTokens = input.extract._meta?.factsTokens ?? 0;
  const servingSize = input.extract._meta?.servingSize ?? null;
  const productType = input.extract._meta?.productType ?? 'other';

  // Data quality
  const dataQuality: DataQuality =
    factsSource === 'ocr' && factsTokens >= 2 && ingredients.length < 3 ? 'ocr-only'
    : (factsTokens >= 2 && ingredients.length >= 3 ? 'good' : 'partial');

  // Certifications (quick pass over title + facts)
  const certs = detectCerts([displayTitle, input.extract.supplementFacts?.raw || '']);

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
    // no doses yet → explicitly call it out
    effectivenessBullets.push('Per-ingredient dosages undisclosed');
  }

  const safetyBullets: string[] = [];
  if (ingredients.some(i => /allergen|milk|soy|egg|wheat|peanut|tree nut/i.test(i))) safetyBullets.push('Allergens present');
  if (ingredients.some(i => /proprietary blend/i.test(i))) safetyBullets.push('Proprietary blend reduces transparency');
  if (safetyBullets.length === 0) safetyBullets.push('No major safety flags detected from label');

  const valueBullets: string[] = ['Value is a placeholder until pricing is wired'];

  return {
    displayTitle,
    score: clamp100(input.score.score),
    purity: clamp100(input.score.purity),
    effectiveness: clamp100(input.score.effectiveness),
    safety: clamp100(input.score.safety),
    value: clamp100(input.score.value),
    highlights: (input.score.highlights || []).slice(0, 3),
    concerns: (input.score.concerns || []).slice(0, 3),
    ingredients,
    certifications: certs,
    meta: { factsSource, factsTokens, servingSize, productType },
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
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return Math.max(0, Math.min(100, v));
}