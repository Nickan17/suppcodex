// src/utils/scoreResult.ts
export type CertBadge =
  | 'Non-GMO'
  | 'Gluten-Free'
  | 'Soy-Free'
  | 'Dairy-Free'
  | 'Vegan'
  | 'NSF'
  | 'cGMP'
  | 'Informed-Choice';

export type NormalizedScore = {
  id: string;
  title: string;
  score: number;
  purity: number;
  effectiveness: number;
  safety: number;
  value: number;
  highlights: string[];
  concerns: string[];
  ingredients: string[];
  servings?: string | null;
  productType?: 'protein' | 'preworkout' | 'vitamin' | 'other';
  factsSource?: string;
  certifications: CertBadge[];
};

const BADGE_PATTERNS: Record<CertBadge, RegExp> = {
  'Non-GMO': /\bnon[-\s]?gmo\b/i,
  'Gluten-Free': /\bgluten[-\s]?free\b/i,
  'Soy-Free': /\bsoy[-\s]?free\b/i,
  'Dairy-Free': /\bdairy[-\s]?free\b/i,
  Vegan: /\bvegan\b/i,
  NSF: /\bnsf\b/i,
  cGMP: /\bcgmp\b/i,
  'Informed-Choice': /\binformed[-\s]?choice\b/i,
};

export function sniffProductType(title: string, ingredients: string[]): NormalizedScore['productType'] {
  const t = `${title} ${ingredients.join(' ')}`.toLowerCase();
  if (/\bprotein\b/.test(t) || /\bwhey|casein|isolate\b/.test(t)) return 'protein';
  if (/\bpre[-\s]?workout\b/.test(t)) return 'preworkout';
  if (/\bvitamin|multivitamin\b/.test(t)) return 'vitamin';
  return 'other';
}

function extractCerts(...sources: (string | undefined)[]): CertBadge[] {
  const blob = sources.filter(Boolean).join(' ');
  const found: CertBadge[] = [];
  (Object.keys(BADGE_PATTERNS) as CertBadge[]).forEach((k) => {
    if (BADGE_PATTERNS[k].test(blob)) found.push(k);
  });
  return Array.from(new Set(found));
}

export function mapExtractAndScoreToNormalized({
  extract,
  score,
}: {
  extract: {
    title?: string;
    ingredients?: string[];
    supplementFacts?: { raw?: string };
    _meta?: { factsSource?: string };
  };
  score: {
    score: number;
    purity: number;
    effectiveness: number;
    safety: number;
    value: number;
    highlights?: string[];
    concerns?: string[];
  };
}): NormalizedScore {
  const title =
    (extract.title && !/customer reviews/i.test(extract.title) ? extract.title : 'Supplement');
  const ingredients = (extract.ingredients ?? []).slice(0, 30); // limit for UI
  const factsText = extract.supplementFacts?.raw ?? '';
  const certifications = extractCerts(title, ingredients.join(', '), factsText);

  return {
    id: crypto.randomUUID(),
    title,
    score: score.score ?? 0,
    purity: score.purity ?? 0,
    effectiveness: score.effectiveness ?? 0,
    safety: score.safety ?? 0,
    value: score.value ?? 0,
    highlights: score.highlights ?? [],
    concerns: score.concerns ?? [],
    ingredients,
    servings: null,
    productType: sniffProductType(title, ingredients),
    factsSource: extract._meta?.factsSource,
    certifications,
  };
}