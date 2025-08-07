// supabase/functions/firecrawl-extract/index.ts
// Robust supplement extraction with clear error handling and telemetry
// ---------------------------------------------------------------------------
// Applied firecrawl-extract fixes: single URL input, correct regex group parsing, clarified handler typing, and TODO for multi-URL expansion.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parseProductPage } from "./parser.ts";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

interface ChainStep {
  provider: string;
  status: "ok" | "empty" | "error";
  ms: number;
  code?: number;
  hint?: string;
}

interface ExtractMeta {
  chain: ChainStep[];
  urls: string[];
  [key: string]: unknown;
  parser?: {
    steps: string[];
    numeric_doses_present: boolean;
  };
  // OCR and facts telemetry
  secondPass?: boolean;
  factsSource?: string;
  factsTokens?: number;
  ocrTried?: boolean;
  ocrPicked?: string;
  rateLimited?: number; // ms spent waiting for rate limiter
}

interface ParsedResult {
  title?: string;
  ingredients?: string[];
  supplementFacts?: {
    raw?: string;
    servingSize?: string;
    servingsPerContainer?: number;
  };
  warnings?: string[];
  raw?: unknown;
}

interface SuccessResponse {
  title?: string;
  ingredients?: string[];
  supplementFacts?: { raw: string };
  warnings?: string[];
  // raw?: unknown;
  _meta: ExtractMeta;
}

interface ErrorResponse {
  error: string;
  message: string;
  got?: unknown;
  _meta?: ExtractMeta;
}

// ---------------------------------------------------------------------------
// Configuration & Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const FIRECRAWL_TIMEOUT = 30_000; // 30 seconds
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

// Simple token bucket rate limiter for Firecrawl requests
const RATE_LIMIT_TOKENS = Number(Deno.env.get("FIRECRAWL_RPS") || "5");
const RATE_LIMIT_INTERVAL_MS = 1000;
let availableTokens = RATE_LIMIT_TOKENS;
let lastRefill = Date.now();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeToken(): Promise<number> {
  let waited = 0;
  while (true) {
    const now = Date.now();
    if (now - lastRefill >= RATE_LIMIT_INTERVAL_MS) {
      availableTokens = RATE_LIMIT_TOKENS;
      lastRefill = now;
    }
    if (availableTokens > 0) {
      availableTokens--;
      return waited;
    }
    const wait = RATE_LIMIT_INTERVAL_MS - (now - lastRefill);
    await delay(wait);
    waited += wait;
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (!Number.isNaN(secs)) return secs * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

/**
 * Create a JSON response with proper CORS headers
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Fetch with timeout and abort controller
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FIRECRAWL_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate and normalize input payload
 */
function normalizeInput(body: unknown): { urls: string[]; error?: ErrorResponse } {
  if (!body || typeof body !== 'object') {
    return {
      urls: [],
      error: {
        error: "bad_request",
        message: "Expected { urls: string[] } or { url: string }",
        got: body,
      },
    };
  }

  const payload = body as Record<string, unknown>;

  // Handle { urls: string[] }
  if (Array.isArray(payload.urls)) {
    const validUrls = payload.urls.filter(
      (url): url is string => typeof url === 'string' && url.length > 0
    );
    
    if (validUrls.length === 0) {
      return {
        urls: [],
        error: {
          error: "bad_request",
          message: "Expected non-empty URLs in urls array",
          got: body,
        },
      };
    }
    
    return { urls: validUrls };
  }

  // Handle { url: string }
  if (typeof payload.url === 'string' && payload.url.length > 0) {
    return { urls: [payload.url] };
  }

  // Neither format found
  return {
    urls: [],
    error: {
      error: "bad_request",
      message: "Expected { urls: string[] } or { url: string }",
      got: body,
    },
  };
}

/**
 * Call Firecrawl API and return telemetry
 */
async function callFirecrawl(
  url: string,
  apiKey: string,
  isSecondPass = false,
): Promise<{ result: unknown; step: ChainStep; rateLimited: number }> {
  const startTime = Date.now();
  let attempt = 0;
  let backoff = 200;
  let waitedTotal = 0;

  while (attempt < 5) {
    attempt++;
    const waited = await takeToken();
    waitedTotal += waited;

    try {
      console.log(`🔥 Calling Firecrawl${isSecondPass ? ' (second pass)' : ''} for: ${url}`);

      const response = await fetchWithTimeout(FIRECRAWL_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          // For second pass, only use HTML and disable main content filtering
          formats: isSecondPass ? ["html"] : ["html", "markdown"],
          onlyMainContent: !isSecondPass,
          timeout: 35000
        }),
      });

      const ms = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        const hasContent = result?.success && (result?.data?.markdown || result?.data?.html);
        return {
          result,
          step: {
            provider: isSecondPass ? "firecrawl-second" : "firecrawl",
            status: hasContent ? "ok" : "empty",
            ms,
            code: response.status,
            ...(hasContent ? {} : { hint: "No content returned from Firecrawl" }),
          },
          rateLimited: waitedTotal,
        };
      }

      const errorText = await response.text().catch(() => "Unknown error");
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const shouldRetry = attempt < 5 && [429, 500, 502, 503, 504].includes(response.status);
      if (shouldRetry) {
        const sleep = retryAfter ?? backoff;
        await delay(sleep);
        waitedTotal += sleep;
        backoff = Math.min(backoff * 2, 1600);
        continue;
      }

      return {
        result: null,
        step: {
          provider: isSecondPass ? "firecrawl-second" : "firecrawl",
          status: "error",
          ms,
          code: response.status,
          hint: `HTTP ${response.status}: ${errorText}`,
        },
        rateLimited: waitedTotal,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (attempt < 5) {
        await delay(backoff);
        waitedTotal += backoff;
        backoff = Math.min(backoff * 2, 1600);
        continue;
      }
      const ms = Date.now() - startTime;
      console.error(`❌ Firecrawl error${isSecondPass ? ' (second pass)' : ''} for ${url}:`, errorMessage);
      return {
        result: null,
        step: {
          provider: isSecondPass ? "firecrawl-second" : "firecrawl",
          status: "error",
          ms,
          hint: `Request failed: ${errorMessage}`,
        },
        rateLimited: waitedTotal,
      };
    }
  }

  const ms = Date.now() - startTime;
  return {
    result: null,
    step: {
      provider: isSecondPass ? "firecrawl-second" : "firecrawl",
      status: "error",
      ms,
      hint: "Exceeded retry limit",
    },
    rateLimited: waitedTotal,
  };
}

/**
 * Fallback to Scrapfly provider
 */
async function callScrapfly(
  url: string,
  apiKey: string,
): Promise<{ html: string | null; step: ChainStep }> {
  const startTime = Date.now();
  try {
    console.log(`🕷️ Calling Scrapfly for: ${url}`);
    const response = await fetchWithTimeout("https://api.scrapfly.io/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ url, render_js: false }),
    });

    const ms = Date.now() - startTime;
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        html: null,
        step: {
          provider: "scrapfly",
          status: "error",
          ms,
          code: response.status,
          hint: `HTTP ${response.status}: ${errorText}`,
        },
      };
    }

    const contentType = response.headers.get("content-type") || "";
    let html: string | null = null;
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      html = json?.result?.content || json?.content || null;
    } else {
      html = await response.text();
    }

    const hasContent = !!html;
    return {
      html: hasContent ? html : null,
      step: {
        provider: "scrapfly",
        status: hasContent ? "ok" : "empty",
        ms,
        code: response.status,
        ...(hasContent ? {} : { hint: "No content returned from Scrapfly" }),
      },
    };

  } catch (error) {
    const ms = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Scrapfly error for ${url}:`, errorMessage);
    return {
      html: null,
      step: {
        provider: "scrapfly",
        status: "error",
        ms,
        hint: `Request failed: ${errorMessage}`,
      },
    };
  }
}

/**
 * Extract a section from text by looking for specific headings
 */
function getSection(text: string, headings: string[], maxLines = 30): string | undefined {
  const lines = text.split('\n');
  let inSection = false, collected: string[] = [];
  const headingRegex = new RegExp(`^#{1,6}\\s*(${headings.join('|')})\\b`, 'i');
  for (const line of lines) {
    if (!inSection && headingRegex.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s/.test(line) || collected.length >= maxLines) break;
      collected.push(line);
    }
  }
  return collected.length ? collected.join('\n').trim() : undefined;
}

/**
 * Parse and normalize Firecrawl result into our standard format
 */
function parseFirecrawlResult(firecrawlResult: unknown): ParsedResult {
  if (!firecrawlResult || typeof firecrawlResult !== 'object') {
    return { raw: firecrawlResult };
  }

  const result = firecrawlResult as Record<string, unknown>;
  const data = result?.data as Record<string, unknown> | undefined;
  if (!data) {
    return { raw: firecrawlResult };
  }

  const parsed: ParsedResult = {
    raw: firecrawlResult,
  };

  // Use unified content string
  const content: string = 
    typeof data.markdown === 'string'
      ? data.markdown
      : (typeof data.html === 'string' ? data.html : '');

  // Extract title from metadata or content
  if (data.metadata && typeof data.metadata === 'object') {
    const metadata = data.metadata as Record<string, unknown>;
    if (metadata.title) {
      parsed.title = String(metadata.title);
    }
  }
  
  if (!parsed.title && content) {
    const titleMatch = content.match(/^#{1,2}\s+(.+)$/m);
    if (titleMatch?.[1]) {
      parsed.title = titleMatch[1].trim();
    }
  }

  // Extract ingredients
  if (content) {
    const ingSec = getSection(content, ['ingredients', 'ingredient list']);
    if (ingSec) {
      parsed.ingredients = ingSec
        .split(/\n/)
        .flatMap(line => line.split(/[,;]/))
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      const m = content.match(/ingredients?\s*:?\s*([^\n]+)/i);
      if (m?.[1]) {
        parsed.ingredients = m[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
      }
    }

    // Extract supplement facts
    const factsSec = getSection(content, ['supplement facts', 'nutrition facts'], 40);
    if (factsSec) {
      parsed.supplementFacts = { raw: factsSec };
    } else {
      const m = content.match(/supplement\s+facts?\s*:?\s*([\s\S]{1,800})/i);
      if (m?.[1]) {
        parsed.supplementFacts = { raw: m[1].trim() };
      }
    }

    // Extract warnings
    const warnSec = getSection(content, ['warnings', 'warning', 'caution'], 12);
    if (warnSec) {
      parsed.warnings = [warnSec];
    } else {
      const m = content.match(/warning[s]?\s*:?\s*([\s\S]{1,400})/i);
      if (m?.[1]) {
        parsed.warnings = [m[1].trim()];
      }
    }
  }

  return parsed;
}

/**
 * Check if parsed result has usable content
 */
function hasUsableContent(parsed: ParsedResult): boolean {
  return !!(
    parsed.title ||
    (parsed.ingredients && parsed.ingredients.length > 0) ||
    parsed.supplementFacts?.raw
  );
}

/**
 * Count supplement facts tokens in text
 */
function countFactsTokens(text?: string): number {
  if (!text) return 0;
  return ((text || '').match(/(serving size|amount per serving|% dv|calories|protein|mg|mcg|iu|supplement\s+facts|nutrition\s+facts)/gi) || []).length;
}

/**
 * Check if we need a second pass based on content quality
 */
function needsSecondPass(parsedResult: any, factsTokens: number): boolean {
  const hasContent = !!(
    parsedResult.title ||
    (parsedResult.ingredients && parsedResult.ingredients.length > 0) ||
    parsedResult.supplementFacts?.raw
  );
  
  return !hasContent || factsTokens < 2;
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Only accept POST
  if (request.method !== "POST") {
    return jsonResponse({
      error: "method_not_allowed",
      message: "Only POST method is supported",
    }, 405);
  }

  // Initialize telemetry
  const meta: ExtractMeta = {
    chain: [],
    urls: [],
  };

  try {
    // 1. Check for FIRECRAWL_API_KEY
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("❌ FIRECRAWL_API_KEY environment variable is missing");
      return jsonResponse({
        error: "config",
        message: "FIRECRAWL_API_KEY missing",
      }, 400);
    }

    // 2. Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      console.error("❌ Failed to parse JSON body:", error);
      return jsonResponse({
        error: "bad_request", 
        message: "Invalid JSON in request body",
        got: "unparseable",
      }, 400);
    }

    const { urls, error: inputError } = normalizeInput(body);
    if (inputError) {
      return jsonResponse(inputError, 400);
    }

    meta.urls = urls;
    console.log(`📋 Processing ${urls.length} URL(s):`, urls);
    if (urls.length > 1) {
      console.warn("⚠️ More than one URL provided, but only the first will be processed.");
    }

    // 3. Process first URL (TODO: Add batch support)
    const url = urls[0];
    if (!url) {
        return jsonResponse({ error: "bad_request", message: "No URL provided in input", _meta: meta }, 400);
    }
    
    // First pass
    const { result: firecrawlResult, step: firecrawlStep, rateLimited: rl1 } = await callFirecrawl(url, apiKey, false);
    meta.chain.push(firecrawlStep);
    let rateLimitedTotal = rl1;

    // 4. Parse the result
    let data = (firecrawlResult as any)?.data ?? {};
    let html = typeof data?.html === 'string' ? data.html : '';
    let md = typeof data?.markdown === 'string' ? data.markdown : '';
    // parseProductPage prefers HTML; if only markdown exists, wrap it
    let htmlForParser = html || (md ? `<article>${md}</article>` : '');

    // get OCR key if present
    const OCRSPACE_API_KEY = Deno.env.get("OCRSPACE_API_KEY") || undefined;
    const SCRAPFLY_API_KEY = Deno.env.get("SCRAPFLY_API_KEY") || undefined;

    // Parse with first pass content
    let parsedRich = await parseProductPage(htmlForParser, url, null, { OCRSPACE_API_KEY });
    let finalFactsTokens = countFactsTokens(parsedRich.supplement_facts);
    const shouldDoSecondPass = needsSecondPass(parsedRich, finalFactsTokens);

    if (shouldDoSecondPass) {
      console.log(`🔄 Triggering second pass for ${url} (factsTokens: ${finalFactsTokens})`);

      // Second pass with different parameters
      const { result: secondResult, step: secondStep, rateLimited: rl2 } = await callFirecrawl(url, apiKey, true);
      meta.chain.push(secondStep);
      rateLimitedTotal += rl2;

      if (secondResult) {
        // Re-parse with second pass content
        const secondData = (secondResult as any)?.data ?? {};
        const secondHtml = typeof secondData?.html === 'string' ? secondData.html : '';

        if (secondHtml) {
          parsedRich = await parseProductPage(secondHtml, url, null, { OCRSPACE_API_KEY });
        }
      }

      finalFactsTokens = countFactsTokens(parsedRich.supplement_facts);
      // Mark that we did a second pass
      meta.secondPass = true;
    }

    // Scrapfly fallback if Firecrawl failed or content weak
    let usedScrapfly = false;
    if (
      SCRAPFLY_API_KEY &&
      (meta.chain.some(s => s.provider.startsWith('firecrawl') && s.status === 'error') || finalFactsTokens < 2)
    ) {
      const { html: scrapHtml, step: scrapStep } = await callScrapfly(url, SCRAPFLY_API_KEY);
      meta.chain.push(scrapStep);
      if (scrapHtml) {
        parsedRich = await parseProductPage(scrapHtml, url, null, { OCRSPACE_API_KEY });
        finalFactsTokens = countFactsTokens(parsedRich.supplement_facts);
        usedScrapfly = true;
      }
    }

    if (rateLimitedTotal > 0) meta.rateLimited = rateLimitedTotal;

    // Map ParsedProduct -> our SuccessResponse
    const ingredientsArray =
      parsedRich.ingredients_raw
        ? parsedRich.ingredients_raw
            .replace(/^ingredients?:/i, '')
            .split(/[,;\n]/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

    const factsRaw =
      parsedRich.supplement_facts
        || '';

    // Add OCR and facts telemetry to meta
    const out: SuccessResponse = {
      title: parsedRich.title || 'Unknown Product',
      ingredients: ingredientsArray,
      supplementFacts: factsRaw ? { raw: factsRaw } : undefined,
      warnings: parsedRich.warnings && parsedRich.warnings.length
        ? parsedRich.warnings
        : [],
      // raw: firecrawlResult, // Raw output removed to prevent invalid JSON errors
      _meta: {
        ...meta,
        parser: {
          steps: parsedRich._meta?.parserSteps ?? [],
          numeric_doses_present: parsedRich.numeric_doses_present ?? false
        },
        // Telemetry from parser
        factsSource: parsedRich._meta?.factsSource,
        factsTokens: finalFactsTokens,
        ocrTried: parsedRich._meta?.ocrTried || false,
        ocrPicked: parsedRich._meta?.ocrPicked,
        facts_kind: parsedRich._meta?.facts_kind,
        ingredients_source: parsedRich._meta?.ingredients_source,
        had_numeric_doses: parsedRich._meta?.had_numeric_doses,
        ...(usedScrapfly ? { provider: 'scrapfly' } : {}),
      }
    };

    // 5. Check if we got usable content
    const hasAny =
      !!out.title ||
      (out.ingredients && out.ingredients.length > 0) ||
      !!out.supplementFacts?.raw;

    if (!hasAny) {
      return jsonResponse({
        error: "empty_parse",
        message: "No usable content parsed",
        _meta: meta,
      }, 422);
    }

    // 6. Success! Return parsed result
    console.log(`✅ Successfully parsed content from ${url}`);

    return jsonResponse(out, 200);

  } catch (error) {
    // Catch any unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Unexpected error in firecrawl-extract:", errorMessage);
    
    return jsonResponse({
      error: "provider_error",
      message: errorMessage,
      _meta: meta,
    }, 400);
  }
}

// ---------------------------------------------------------------------------
// Export & Serve
// ---------------------------------------------------------------------------

serve(handler);
export { handler };