import { mapExtractAndScoreToNormalized } from '../scoreResult';

// Simple test without React Native dependencies
describe('scoreResult normalization (isolated)', () => {
  it('calculates good data quality correctly', () => {
    const result = mapExtractAndScoreToNormalized({
      extract: { 
        title: 'Test Product', 
        ingredients: ['ingredient a', 'ingredient b', 'ingredient c'], 
        _meta: { factsSource: 'html', factsTokens: 3 } 
      },
      score: { score: 80, purity: 80, effectiveness: 80, safety: 80, value: 80, highlights: [], concerns: [] }
    });

    expect(result.dataQuality).toBe('good');
    expect(result.displayTitle).toBe('Test Product');
    expect(result.scoringVersion).toBe('1.2.0');
    expect(result.rubric).toBeDefined();
    expect(result.rubric.purity).toEqual(['Label appears relatively clean']);
  });

  it('calculates ocr-only data quality correctly', () => {
    const result = mapExtractAndScoreToNormalized({
      extract: { 
        title: 'Test Product', 
        ingredients: ['ingredient a'], 
        _meta: { factsSource: 'ocr', factsTokens: 2 } 
      },
      score: { score: 70, purity: 70, effectiveness: 70, safety: 70, value: 70, highlights: [], concerns: [] }
    });

    expect(result.dataQuality).toBe('ocr-only');
  });

  it('adds undisclosed dosages bullet for non-protein products', () => {
    const result = mapExtractAndScoreToNormalized({
      extract: { 
        title: 'Pre-Workout', 
        ingredients: ['caffeine'], 
        _meta: { factsSource: 'html', factsTokens: 2, productType: 'preworkout' } 
      },
      score: { score: 60, purity: 60, effectiveness: 60, safety: 60, value: 60, highlights: [], concerns: [] }
    });

    expect(result.rubric.effectiveness).toContain('Per-ingredient dosages undisclosed');
  });

  it('clamps scores to valid range', () => {
    const result = mapExtractAndScoreToNormalized({
      extract: { 
        title: 'Test', 
        ingredients: ['test'], 
        _meta: { factsSource: 'html', factsTokens: 1 } 
      },
      score: { score: 150, purity: -10, effectiveness: 95.7, safety: 0, value: 100, highlights: [], concerns: [] }
    });

    expect(result.score).toBe(100);
    expect(result.purity).toBe(0);
    expect(result.effectiveness).toBe(96);
  });
});