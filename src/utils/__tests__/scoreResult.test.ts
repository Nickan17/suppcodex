import { normalizeIngredients, fallbackIngredientsFromFacts, mapExtractAndScoreToNormalized } from '../scoreResult';

describe('ingredients normalization', () => {
  it('keeps array ingredients as-is (deduped, trimmed)', () => {
    const out = normalizeIngredients(['Ingredients: Whey Protein', 'Salt', 'Salt', 'Lecithin']);
    expect(out).toEqual(['Whey Protein', 'Salt', 'Lecithin']);
  });

  it('splits string on commas/semis/newlines', () => {
    const out = normalizeIngredients('Ingredients: Whey Protein, Salt; Lecithin\nNatural Flavor');
    expect(out).toEqual(['Whey Protein', 'Salt', 'Lecithin', 'Natural Flavor']);
  });

  it('falls back to facts when array missing', () => {
    const out = fallbackIngredientsFromFacts('SUPPLEMENT FACTS\nIngredients: Whey Protein Isolate, Salt, Enzyme');
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it('wire-up: mapExtract… returns ingredients from array first', () => {
    const n = mapExtractAndScoreToNormalized({
      extract: {
        title: 'X',
        ingredients: ['Whey Protein Isolate', 'Salt'],
        supplementFacts: { raw: 'Ingredients: Not used' }
      },
      score: {}
    } as any);
    expect(n.ingredients).toEqual(['Whey Protein Isolate', 'Salt']);
  });

  it('wire-up: falls back to facts if array empty', () => {
    const n = mapExtractAndScoreToNormalized({
      extract: {
        title: 'X',
        ingredients: [],
        supplementFacts: { raw: 'Ingredients: Whey Protein, Salt' }
      },
      score: {}
    } as any);
    expect(n.ingredients).toEqual(['Whey Protein', 'Salt']);
  });
}); 