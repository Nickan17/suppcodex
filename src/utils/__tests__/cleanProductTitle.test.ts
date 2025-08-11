import { cleanProductTitle, deriveTitleFromUrl, stripReviewNoise } from '../../utils/cleanProductTitle';

test('strips review boilerplate', () => {
  const raw = '4.98 out of 5 Based on 51 reviews – Write a review – Magnum Quattro Protein Isolate';
  const cleaned = cleanProductTitle(raw);
  expect(cleaned).toMatch(/Magnum Quattro Protein Isolate/i);
  expect(cleaned).not.toMatch(/reviews|write a review/i);
});

test('falls back to URL', () => {
  expect(deriveTitleFromUrl('https://site.com/products/magnum-quattro-2lb')).toBe('Magnum Quattro 2lb');
  const cleaned = cleanProductTitle('', { url: 'https://site.com/products/magnum-quattro' });
  expect(cleaned).toBe('Magnum Quattro');
});

test('clamps long titles', () => {
  const out = cleanProductTitle('X'.repeat(500), { max: 80 });
  expect(out.length).toBeLessThanOrEqual(81);
}); 