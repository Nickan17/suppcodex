/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock setTimeout for sleep function
jest.useFakeTimers();

// Mock Deno env for tests
declare global {
  const Deno: {
    env: {
      get: jest.MockedFunction<(key: string) => string | undefined>;
    };
  };
}

global.Deno = {
  env: {
    get: jest.fn(),
  },
};

// Mock the handler function - we'll test the core retry logic by importing the functions
// Since the functions are not exported, we'll test via the handler endpoint
describe('firecrawl-extract retry logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('Firecrawl retry with exponential backoff', () => {
    it('should retry on 429 status with exponential delay', async () => {
      // Mock environment variables
      (global.Deno.env.get as jest.MockedFunction<any>).mockImplementation((key: string) => {
        if (key === 'FIRECRAWL_API_KEY') return 'test-firecrawl-key';
        return undefined;
      });

      // Mock the fetch responses: 429 -> 429 -> 200
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              html: '<html><body>Test content</body></html>',
              markdown: '# Test content',
            },
          }),
        } as Response);

      // Import the handler to test it
      const { handler } = await import('../firecrawl-extract/index.ts');
      
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Execute the handler in the background
      const handlerPromise = handler(request);

      // Fast-forward through the retry delays
      jest.advanceTimersByTime(1000); // First retry delay (1s)
      await Promise.resolve(); // Let microtasks run
      jest.advanceTimersByTime(2000); // Second retry delay (2s)
      await Promise.resolve(); // Let microtasks run

      const response = await handlerPromise;
      const result = await response.json();

      // Should have made 3 attempts
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Check that the chain includes retry attempts
      expect(result._meta.chain).toHaveLength(3);
      expect(result._meta.chain[0]).toMatchObject({
        provider: 'firecrawl',
        try: 1,
        status: 'error',
        code: 429,
      });
      expect(result._meta.chain[1]).toMatchObject({
        provider: 'firecrawl',
        try: 2,
        status: 'error',
        code: 429,
      });
      expect(result._meta.chain[2]).toMatchObject({
        provider: 'firecrawl',
        try: 3,
        status: 'ok',
        code: 200,
      });

      // Should eventually succeed
      expect(response.status).toBe(200);
      expect(result.title).toBeDefined();

      // Clear mocks
      jest.clearAllMocks();
    });

    it('should not retry on 404 status', async () => {
      // Mock environment variables
      (global.Deno.env.get as jest.MockedFunction<any>).mockImplementation((key: string) => {
        if (key === 'FIRECRAWL_API_KEY') return 'test-firecrawl-key';
        if (key === 'SCRAPFLY_API_KEY') return 'test-scrapfly-key';
        return undefined;
      });

      // Mock 404 response from Firecrawl
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Not found'),
        } as Response)
        // Scrapfly fallback response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            result: {
              content: '<html><body>Scrapfly content</body></html>',
              title: 'Scrapfly Title',
            },
          }),
        } as Response);

      const { handler } = await import('../firecrawl-extract/index.ts');
      
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await handler(request);
      const result = await response.json();

      // Should have made only 1 Firecrawl attempt + 1 Scrapfly attempt
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check that chain shows Firecrawl failure and Scrapfly success
      expect(result._meta.chain).toHaveLength(2);
      expect(result._meta.chain[0]).toMatchObject({
        provider: 'firecrawl',
        try: 1,
        status: 'error',
        code: 404,
      });
      expect(result._meta.chain[1]).toMatchObject({
        provider: 'scrapfly',
        status: 'ok',
        code: 200,
      });

      // Clear mocks
      jest.clearAllMocks();
    });
  });

  describe('Scrapfly fallback', () => {
    it('should fallback to Scrapfly when Firecrawl fails', async () => {
      // Mock environment variables
      (global.Deno.env.get as jest.MockedFunction<any>).mockImplementation((key: string) => {
        if (key === 'FIRECRAWL_API_KEY') return 'test-firecrawl-key';
        if (key === 'SCRAPFLY_API_KEY') return 'test-scrapfly-key';
        return undefined;
      });

      // Mock Firecrawl failure and Scrapfly success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        } as Response)
        // Scrapfly response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            result: {
              content: '<html><body>Scrapfly content</body></html>',
              title: 'Test Product',
            },
          }),
        } as Response);

      const { handler } = await import('../firecrawl-extract/index.ts');
      
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const handlerPromise = handler(request);

      // Fast-forward through retry delays
      jest.advanceTimersByTime(1000 + 2000 + 4000); // All retry delays
      await Promise.resolve();

      const response = await handlerPromise;
      const result = await response.json();

      // Should show Scrapfly in the provider chain
      expect(result._meta.chain.some((step: any) => step.provider === 'scrapfly')).toBe(true);
      expect(response.status).toBe(200);

      // Clear mocks
      jest.clearAllMocks();
    });

    it('should return error when SCRAPFLY_API_KEY is missing', async () => {
      // Mock environment variables (SCRAPFLY_API_KEY intentionally missing)
      (global.Deno.env.get as jest.MockedFunction<any>).mockImplementation((key: string) => {
        if (key === 'FIRECRAWL_API_KEY') return 'test-firecrawl-key';
        return undefined;
      });

      // Mock Firecrawl failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      } as Response);

      const { handler } = await import('../firecrawl-extract/index.ts');
      
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await handler(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('config');
      expect(result.message).toContain('SCRAPFLY_API_KEY missing');

      // Clear mocks
      jest.clearAllMocks();
    });
  });

  describe('telemetry', () => {
    it('should include try numbers in chain steps', async () => {
      // Mock environment variables
      (global.Deno.env.get as jest.MockedFunction<any>).mockImplementation((key: string) => {
        if (key === 'FIRECRAWL_API_KEY') return 'test-firecrawl-key';
        return undefined;
      });

      // Mock: fail twice, then succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service unavailable'),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service unavailable'),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: { html: '<html><body>Success</body></html>' },
          }),
        } as Response);

      const { handler } = await import('../firecrawl-extract/index.ts');
      
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const handlerPromise = handler(request);
      jest.advanceTimersByTime(3000); // Skip delays
      await Promise.resolve();

      const response = await handlerPromise;
      const result = await response.json();

      expect(result._meta.chain).toHaveLength(3);
      expect(result._meta.chain[0].try).toBe(1);
      expect(result._meta.chain[1].try).toBe(2);
      expect(result._meta.chain[2].try).toBe(3);

      // Clear mocks
      jest.clearAllMocks();
    });
  });
});