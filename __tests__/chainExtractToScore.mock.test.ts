import { chainExtractToScore } from '../src/utils/chainExtractToScore.ts';
import { ProductRecord } from '../src/contexts/ProductContext.tsx';

describe('chainExtractToScore (mocked)', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_USE_MOCK = '1';
  });

  it('should return a valid ProductRecord in mock mode', async () => {
    const record: ProductRecord = await chainExtractToScore('https://example.com');

    expect(record.productId).toBeTruthy();
    expect(typeof record.productId).toBe('string');

    expect(record.productName).toBeTruthy();
    expect(typeof record.productName).toBe('string');

    expect(Array.isArray(record.ingredients)).toBe(true);
    expect(Array.isArray(record.meta?.chain)).toBe(true);
    expect(record.meta.chain.length).toBeGreaterThan(0);
  }, 10000);
});