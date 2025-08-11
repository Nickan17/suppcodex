export const REVIEW_NOISE_RE = /(customer\s+reviews?|see\s+all\s+reviews?|write\s+a\s+review|most\s+helpful|highest|lowest|rating|ratings|pictures?|videos?|stars?|based\s+on|out\s+of\s+5|reviews?\b)/i;

export function looksLikeReviewNoise(s?: string | null): boolean {
  if (!s) return false;
  const txt = String(s).trim();
  if (!txt) return false;
  const digits = (txt.match(/\d/g) || []).length;
  const ratio = digits / Math.max(1, txt.length);
  return REVIEW_NOISE_RE.test(txt) || ratio > 0.3 || /^customer\s+reviews?/i.test(txt);
}

export function deriveTitleFromUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    const slug = (u.pathname || '')
      .split('/')
      .filter(Boolean)
      .pop() || '';
    if (!slug) return null;
    const cleaned = slug
      .replace(/\.(html?|php)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\b(\d+lb|\d+[\s-]?pack|bundle|trial|sample|size|variant)\b/gi, '')
      .trim();
    if (!cleaned) return null;
    return cleaned.replace(/\b\w/g, m => m.toUpperCase());
  } catch { return null; }
}

const REVIEW_NOISE = [
  /based on \d+ reviews?/i,
  /\bwrite a review\b/i,
  /\bsee all reviews\b/i,
  /\bmost (recent|helpful)\b/i,
  /\bphotos?\b/i,
  /\bvideos?\b/i,
  /\brating\b/i,
  /\b(only|first)\b/i,
  /\bverified\b/i,
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
];

export function stripReviewNoise(s: string): string {
  let t = s;
  for (const rx of REVIEW_NOISE) t = t.replace(rx, '');
  t = t.replace(/^\s*\d+(?:\.\d+)?\s*out of\s*5.*?(?=[A-Z]|\d|$)/i, '');
  t = t.replace(/\s+/g, ' ').replace(/[•|]+/g, ' ').trim();
  return t;
}

export function cleanProductTitle(
  raw?: string | null,
  opts?: { url?: string | null; pageTitleRaw?: string | null; max?: number }
): string {
  const max = opts?.max ?? 80;

  let best = '';
  const rawCandidate = raw && !looksLikeReviewNoise(raw) ? raw : '';
  const pageCandidate = opts?.pageTitleRaw && !looksLikeReviewNoise(opts.pageTitleRaw) ? opts.pageTitleRaw : '';

  const candidates = [rawCandidate, pageCandidate].filter(Boolean) as string[];

  for (const c of candidates) {
    const stripped = stripReviewNoise(c);
    if (/[A-Za-z]{3,}/.test(stripped) && stripped.length >= 3) {
      best = stripped;
      break;
    }
  }

  if (!best && opts?.url) best = deriveTitleFromUrl(opts.url) || '';
  if (!best) best = 'Product';

  best = best.replace(/\s+/g, ' ').trim();
  if (best.length > max) best = best.slice(0, max - 1).trimEnd() + '…';
  return best;
}