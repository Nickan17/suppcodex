export function getGrade(score: number | null | undefined): string {
  const s = typeof score === 'number' ? score : -1;
  if (s >= 90) return 'A+';
  if (s >= 85) return 'A';
  if (s >= 80) return 'A-';
  if (s >= 75) return 'B+';
  if (s >= 70) return 'B';
  if (s >= 65) return 'C+';
  if (s >= 60) return 'C';
  if (s >= 50) return 'D';
  if (s >= 0) return 'F';
  return '—';
} 