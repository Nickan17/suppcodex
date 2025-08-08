export function cleanProductTitle(raw?: string | null): string {
  const cleaned = (raw || '')
    .replace(/customer reviews|see all reviews|write a review|most recent|highest rating|lowest rating|pictures|videos|most helpful/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!cleaned || cleaned.length > 120) return 'Unknown Product';
  return cleaned;
}