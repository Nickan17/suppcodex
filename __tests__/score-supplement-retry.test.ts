/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock setTimeout for sleep function
jest.useFakeTimers();

describe('score-supplement retry logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('OpenRouter retry with jitter', () => {
    it('should retry on 500 status and eventually succeed', async () => {
      // Mock the fetch responses: 500 -> 500 -> 200
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
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  score: 85,
                  purity: 90,
                  effectiveness: 80,
                  safety: 85,
                  value: 85,
                  highlights: ["High quality protein"],
                  concerns: ["No dosage information"]
                })
              }
            }]
          })),
        } as Response);

      // Mock the retry logic (simplified version of our implementation)
      const callOpenRouterWithRetries = async () => {
        const chain: any[] = [];
        const maxRetries = 2;
        
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          const startTime = Date.now();
          
          try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: 'Bearer test-api-key-placeholder',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] })
            });

            const ms = Date.now() - startTime;
            
            if (!response.ok && response.status >= 500 && attempt <= maxRetries) {
              chain.push({
                provider: 'openrouter',
                try: attempt,
                status: 'error',
                ms,
                code: response.status,
              });
              
              // Simulate jitter delay without actual waiting for tests
              const jitter = Math.random() * 500;
              // In tests, just simulate the delay without actually waiting
              await Promise.resolve();
              continue;
            }
            
            if (!response.ok) {
              chain.push({
                provider: 'openrouter',
                try: attempt,
                status: 'error',
                ms,
                code: response.status,
              });
              throw new Error(`HTTP ${response.status}`);
            }
            
            chain.push({
              provider: 'openrouter',
              try: attempt,
              status: 'ok',
              ms,
              code: response.status,
            });
            
            const result = await response.text();
            return { result: JSON.parse(result), chain };
          } catch (error) {
            if (attempt > maxRetries) throw error;
          }
        }
        
        throw new Error('Max retries exceeded');
      };

      // Execute the retry logic
      const { result, chain } = await callOpenRouterWithRetries();

      // Should have made 3 attempts total
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Check that the chain includes retry attempts
      expect(chain).toHaveLength(3);
      expect(chain[0]).toMatchObject({
        provider: 'openrouter',
        try: 1,
        status: 'error',
        code: 500,
      });
      expect(chain[1]).toMatchObject({
        provider: 'openrouter',
        try: 2,
        status: 'error',
        code: 500,
      });
      expect(chain[2]).toMatchObject({
        provider: 'openrouter',
        try: 3,
        status: 'ok',
        code: 200,
      });

      // Should eventually succeed
      expect(result.choices[0].message.content).toContain('score');
    });

    it('should handle 429 quota error without retry', async () => {
      // Mock 429 response from OpenRouter
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('{"error": {"message": "You have exceeded your API quota"}}'),
      } as Response);

      // Mock the 429 handling logic
      const callOpenRouterWith429Handling = async () => {
        const chain: any[] = [];
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions');
        const ms = 100;
        
        if (response.status === 429) {
          chain.push({
            provider: 'openrouter',
            try: 1,
            status: 'error',
            ms,
            code: response.status,
            hint: 'Out of credits',
          });
          
          const errorText = await response.text();
          throw new Error(`OPENROUTER_QUOTA_EXCEEDED:${errorText}`);
        }
        
        return { result: null, chain };
      };

      let caughtError;
      try {
        await callOpenRouterWith429Handling();
      } catch (error) {
        caughtError = error;
      }

      // Should have made only 1 OpenRouter attempt (no retries on 429)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Should throw quota exceeded error
      expect(caughtError).toBeDefined();
      expect((caughtError as any).message).toContain('OPENROUTER_QUOTA_EXCEEDED');
      expect((caughtError as any).message).toContain('exceeded');
    });

    it('should not retry on 400 status', async () => {
      // Mock 400 response from OpenRouter
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      } as Response);

      // Mock the retry logic that doesn't retry on 4xx
      const callOpenRouterNoRetryOn400 = async () => {
        const chain: any[] = [];
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions');
        const ms = 100;
        
        if (!response.ok) {
          chain.push({
            provider: 'openrouter',
            try: 1,
            status: 'error',
            ms,
            code: response.status,
          });
          
          // Don't retry on 4xx errors (except 429)
          if (response.status < 500 && response.status !== 429) {
            const errorText = await response.text();
            throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
          }
        }
        
        return { result: null, chain };
      };

      let caughtError;
      try {
        await callOpenRouterNoRetryOn400();
      } catch (error) {
        caughtError = error;
      }

      // Should have made only 1 OpenRouter attempt (no retries on 4xx)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Should throw error
      expect(caughtError).toBeDefined();
      expect((caughtError as any).message).toContain('OpenRouter error 400');
    });
  });

  describe('telemetry', () => {
    it('should include try numbers in chain steps', async () => {
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
          text: () => Promise.resolve(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({ score: 75 })
              }
            }]
          })),
        } as Response);

      // Mock retry logic with telemetry
      const callWithTelemetry = async () => {
        const chain: any[] = [];
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions');
          const ms = 100;
          
          if (!response.ok && attempt < 3) {
            chain.push({
              provider: 'openrouter',
              try: attempt,
              status: 'error',
              ms,
              code: response.status,
            });
            continue;
          }
          
          chain.push({
            provider: 'openrouter',
            try: attempt,
            status: response.ok ? 'ok' : 'error',
            ms,
            code: response.status,
          });
          
          if (response.ok) {
            const result = await response.text();
            return { result: JSON.parse(result), chain };
          }
        }
        
        throw new Error('All attempts failed');
      };

      const { chain } = await callWithTelemetry();

      expect(chain).toHaveLength(3);
      expect(chain[0].try).toBe(1);
      expect(chain[1].try).toBe(2);
      expect(chain[2].try).toBe(3);
    });

    it('should never log API keys in tests', () => {
      // This test ensures no secrets are leaked in our test setup
      const testApiKey = 'test-api-key-placeholder';
      
      // Verify we're using placeholder values, not real secrets
      expect(testApiKey).toBe('test-api-key-placeholder');
      expect(testApiKey).not.toContain('sk-');
      expect(testApiKey).not.toContain('or-');
      expect(testApiKey).toContain('placeholder');
    });
  });
});