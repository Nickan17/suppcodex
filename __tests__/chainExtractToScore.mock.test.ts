import { chainExtractToScore, ChainResult } from '@/utils/chainExtractToScore';

describe('chainExtractToScore (mocked)', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_USE_MOCK = '1';
  });

  it('should return a valid ChainResult in mock mode', async () => {
    const result: ChainResult = await chainExtractToScore('https://example.com');

    expect(result.product).toBeTruthy();
    expect(typeof result.product.title).toBe('string');

    expect(result.product.title).toBeTruthy();
    expect(typeof result.product.title).toBe('string');

    expect(Array.isArray(result.product.ingredients)).toBe(true);
    expect(Array.isArray(result.meta?.chain)).toBe(true);
    expect(result.meta.chain?.length).toBeGreaterThan(0);
  }, 10000);
});