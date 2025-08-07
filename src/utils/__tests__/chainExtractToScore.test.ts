// Mock environment and dependencies before importing
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key'
    }
  }
}));

// Mock Supabase client
const mockInvoke = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    functions: {
      invoke: mockInvoke
    }
  })
}));

import { chainExtractToScore } from '../chainExtractToScore';

describe('chainExtractToScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles extract failure gracefully', async () => {
    // Mock extract failure
    mockInvoke.mockResolvedValueOnce({
      error: 'Network error',
      data: null
    });

    const result = await chainExtractToScore('https://example.com');

    expect(result.score.score).toBe(0);
    expect(result.score.highlights).toEqual([]);
    expect(result.score.concerns).toEqual([]);
    expect(result.meta.extract?.error).toBeDefined();
  });

  it('handles successful extract with facts fallback', async () => {
    // Mock successful extract with markdown content
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          title: 'Test Product',
          ingredients: ['Vitamin D', 'Magnesium'],
          raw: {
            data: {
              markdown: 'This is a long markdown content that should be used as fallback facts when supplementFacts.raw is empty. '.repeat(10)
            }
          }
        },
        response: { ok: true }
      })
      // Mock successful score response
      .mockResolvedValueOnce({
        data: {
          score: 75,
          highlights: ['Good bioavailability', 'Third-party tested'],
          concerns: ['High dosage']
        },
        response: { ok: true }
      });

    const result = await chainExtractToScore('https://example.com');

    expect(result.score.score).toBe(75);
    expect(result.score.highlights).toEqual(['Good bioavailability', 'Third-party tested']);
    expect(result.score.concerns).toEqual(['High dosage']);
    expect(result.product.title).toBe('Test Product');
  });

  it('handles scorer failure with extract success', async () => {
    // Mock successful extract
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          title: 'Test Product',
          ingredients: ['Vitamin D'],
          supplementFacts: { raw: 'Serving Size: 1 capsule\nVitamin D: 1000 IU' }
        },
        response: { ok: true }
      })
      // Mock scorer failure
      .mockResolvedValueOnce({
        error: 'Scorer service unavailable',
        data: null
      });

    const result = await chainExtractToScore('https://example.com');

    expect(result.score.score).toBe(0);
    expect(result.product.title).toBe('Test Product');
    expect(result.meta.score?.error).toBeDefined();
  });

  it('uses ingredients fallback when no other facts available', async () => {
    // Mock extract with only ingredients
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          title: 'Test Product',
          ingredients: ['Vitamin C', 'Zinc', 'Elderberry Extract'],
          raw: { data: { markdown: '', html: '' } }
        },
        response: { ok: true }
      })
      .mockResolvedValueOnce({
        data: { score: 50, highlights: [], concerns: [] },
        response: { ok: true }
      });

    const result = await chainExtractToScore('https://example.com');

    // Check that ingredients fallback was used
    expect(mockInvoke).toHaveBeenCalledWith('score-supplement', {
      body: expect.objectContaining({
        facts: expect.stringContaining('Ingredients: Vitamin C, Zinc, Elderberry Extract')
      })
    });
  });

  it('handles malformed scorer response gracefully', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: { title: 'Test', ingredients: [] },
        response: { ok: true }
      })
      .mockResolvedValueOnce({
        data: {
          score: 'invalid', // String instead of number
          highlights: 'not an array', // Not an array
          concerns: [123, null, '', 'Valid concern'] // Mixed types
        },
        response: { ok: true }
      });

    const result = await chainExtractToScore('https://example.com');

    expect(result.score.score).toBe(0); // Invalid score becomes 0
    expect(result.score.highlights).toEqual([]); // Non-array becomes empty
    expect(result.score.concerns).toEqual(['Valid concern']); // Only valid strings kept
  });
});