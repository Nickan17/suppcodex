import aliases from './aliases.json';
import ranges from './ranges.json';

export type DoseFit = 'below' | 'within' | 'above' | 'unknown';

export function canonicalize(name: string): string {
  const n = name.toLowerCase();
  for (const [canon, alts] of Object.entries(aliases)) {
    if (n === canon || (alts as string[]).includes(n)) return canon;
  }
  return n;
}

/**
 * doseFit(): Placeholder guard — do NOT parse/evaluate doses yet.
 * In future, feed parsed {amount, unit} from label data.
 */
export function doseFit(canonical: string, dose: { amount: number; unit: string } | null): DoseFit {
  if (!dose) return 'unknown';
  const row = (ranges as any[]).find(r => r.canonical === canonical);
  if (!row) return 'unknown';
  if (dose.unit.toLowerCase() !== row.unit.toLowerCase()) return 'unknown';
  if (dose.amount < row.low) return 'below';
  if (dose.amount > row.high) return 'above';
  return 'within';
}

export { aliases, ranges };