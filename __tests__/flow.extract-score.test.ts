import { chainExtractToScore, type InvokeFn } from '../utils/api';

describe('chainExtractToScore', () => {
  const mockInvoke = jest.fn() as unknown as InvokeFn;

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('should gate scoring when extract returns ok but no parsed', async () => {
    const mockUrl = 'https://example.com';

    (mockInvoke as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, data: { _meta: { status: 'parser_fail' } } });

    const resA = await chainExtractToScore(mockUrl, { invoke: mockInvoke });

    expect(resA.ok).toBe(false);
    expect(resA.status).toBe(422);
    expect((mockInvoke as jest.Mock).mock.calls.length).toBe(1);
    expect((mockInvoke as jest.Mock).mock.calls[0][0]).toBe('firecrawl-extract');
  });

  it('should chain extract to score successfully when parsed exists', async () => {
    const mockUrl = 'https://example.com';

    (mockInvoke as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, data: { parsed: { title: 'T', ingredients_raw: 'Vitamin C 500 mg' } } });
    (mockInvoke as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, data: { score: 85 } });

    const resB = await chainExtractToScore(mockUrl, { invoke: mockInvoke });

    expect(resB.ok).toBe(true);
    expect(resB.status).toBe(200);
    expect(resB.data?.score).toBe(85);
    expect((mockInvoke as jest.Mock).mock.calls.length).toBe(2);
    expect((mockInvoke as jest.Mock).mock.calls[1][0]).toBe('score-supplement');
  });
}); 