/**
 * Convert numeric score to letter grade
 */
export function toGrade(score: number): string {
  if (!Number.isFinite(score)) return '—';
  
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  
  if (clampedScore === 0) return '—';
  if (clampedScore >= 95) return 'A+';
  if (clampedScore >= 90) return 'A';
  if (clampedScore >= 85) return 'A-';
  if (clampedScore >= 80) return 'B+';
  if (clampedScore >= 75) return 'B';
  if (clampedScore >= 70) return 'B-';
  if (clampedScore >= 65) return 'C+';
  if (clampedScore >= 60) return 'C';
  if (clampedScore >= 55) return 'C-';
  if (clampedScore >= 50) return 'D';
  return 'F';
}