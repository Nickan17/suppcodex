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
  try?: number;
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
const SCRAPFLY_API_URL = "https://scrapfly.io/api/scrape";

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Try Shopify JSON endpoint for product data
 */
async function tryShopifyJson(url: string): Promise<{ result: ParsedResult | null; step: ChainStep }> {
  const startTime = Date.now();
  
  try {
    // Extract handle from URL (e.g., /products/quattro -> quattro)
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/products\/([^\/]+)/);
    if (!match) {
      return {
        result: null,
        step: {
          provider: "shopify-json",
          status: "error",
          ms: Date.now() - startTime,
          hint: "Not a Shopify product URL"
        }
      };
    }
    
    const handle = match[1];
    const jsonUrl = `${urlObj.origin}/products/${handle}.js`;
    
    const response = await fetchWithTimeout(jsonUrl, {}, 15000);
    const ms = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        result: null,
        step: {
          provider: "shopify-json",
          status: "error",
          ms,
          code: response.status,
          hint: `HTTP ${response.status}`
        }
      };
    }
    
    const productData = await response.json();
    
    // Extract title and ingredients from Shopify JSON
    const title = productData?.title || '';
    const bodyHtml = productData?.body_html || '';
    
    // Parse body_html for numeric doses (mg, IU, g, etc.)
    const numericDoseRegex = /\b(\d+(?:\.\d+)?)\s*(mg|iu|g|mcg|μg|units?)\b/gi;
    const hasNumericDoses = numericDoseRegex.test(bodyHtml);
    
    // Extract ingredients from description
    const ingredients: string[] = [];
    const ingredientMatch = bodyHtml.match(/ingredients?:?\s*([^<]*)/i);
    if (ingredientMatch) {
      const ingredientText = ingredientMatch[1].replace(/<[^>]*>/g, '').trim();
      ingredients.push(...ingredientText.split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 0));
    }
    
    const result: ParsedResult = {
      title,
      ingredients,
      supplementFacts: {
        raw: bodyHtml
      },
      warnings: [],
      raw: productData
    };
    
    return {
      result,
      step: {
        provider: "shopify-json",
        status: hasNumericDoses && ingredients.length > 0 ? "ok" : "empty",
        ms,
        code: response.status,
        hint: !hasNumericDoses ? "No numeric doses found" : 
              ingredients.length === 0 ? "No ingredients found" : undefined
      }
    };
    
  } catch (error) {
    const ms = Date.now() - startTime;
    return {
      result: null,
      step: {
        provider: "shopify-json",
        status: "error",
        ms,
        hint: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Strip review blobs from supplement facts to prevent UI clutter
 */
function stripReviewsBlob(s: string): string {
  if (!s) return s;
  const splitters = [
    /customer reviews/i,
    /see all reviews/i,
    /write a review/i,
    /most recent/i,
    /highest rating/i,
    /lowest rating/i,
    /pictures/i,
    /videos/i,
    /most helpful/i,
  ];
  let cut = s;
  for (const rx of splitters) {
    const m = cut.search(rx);
    if (m > -1) cut = cut.slice(0, m);
  }
  return cut.trim().slice(0, 2000);
}

/**
 * Check if parsed result looks thin and needs fallback
 */
function looksThin(parsedResult: any, hasNumericDoses: boolean = false, factsTokens: number = 0): boolean {
  if (!parsedResult) return true;
  
  // Updated guard logic: check ingredients_raw length instead of count
  const ingredientsLength = parsedResult.ingredients_raw?.length || 0;
  
  return /404/i.test(parsedResult.title || "") ||
         (ingredientsLength < 40 && factsTokens < 2);
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
 * Call Firecrawl API with retries and exponential back-off
 */
async function callFirecrawlWithRetries(
  url: string,
  apiKey: string,
  isSecondPass = false,
): Promise<{ result: unknown; steps: ChainStep[] }> {
  const steps: ChainStep[] = [];
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    
    try {
      console.log(`🔥 Calling Firecrawl${isSecondPass ? ' (second pass)' : ''} for: ${url} (attempt ${attempt}/${maxRetries})`);
      
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
      const result = response.ok ? await response.json() : null;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        const step: ChainStep = {
          provider: isSecondPass ? "firecrawl-second" : "firecrawl",
          try: attempt,
          status: "error",
          ms,
          code: response.status,
          hint: `HTTP ${response.status}: ${errorText}`,
        };
        steps.push(step);

        // Retry on 5xx and 429, but not on other 4xx
        const shouldRetry = (response.status >= 500 || response.status === 429) && attempt < maxRetries;
        if (shouldRetry) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Retrying in ${delay}ms after ${response.status} error...`);
          await sleep(delay);
          continue;
        }
        
        // No more retries or shouldn't retry
        return { result: null, steps };
      }

      // Check if we got usable content from scrape format
      const hasContent = result?.success && (result?.data?.markdown || result?.data?.html);
      
      const step: ChainStep = {
        provider: isSecondPass ? "firecrawl-second" : "firecrawl",
        try: attempt,
        status: hasContent ? "ok" : "empty",
        ms,
        code: response.status,
        ...(hasContent ? {} : { hint: "No content returned from Firecrawl" }),
      };
      steps.push(step);

      return { result, steps };

    } catch (error) {
      const ms = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Firecrawl error${isSecondPass ? ' (second pass)' : ''} for ${url} (attempt ${attempt}):`, errorMessage);
      
      const step: ChainStep = {
        provider: isSecondPass ? "firecrawl-second" : "firecrawl",
        try: attempt,
        status: "error",
        ms,
        hint: `Request failed: ${errorMessage}`,
      };
      steps.push(step);

      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms after network error...`);
        await sleep(delay);
        continue;
      }
    }
  }
  
  return { result: null, steps };
}

/**
 * Call Scrapfly API fallback
 */
async function callScrapfly(
  url: string,
  apiKey: string,
): Promise<{ result: unknown; step: ChainStep }> {
  const startTime = Date.now();
  
  try {
    console.log(`🕷️ Calling Scrapfly fallback for: ${url}`);
    
    const params = new URLSearchParams({
      key: apiKey,
      url: url,
      format: 'json',
      render_js: 'true',
      auto_scroll: 'true',
    });

    const fullUrl = `${SCRAPFLY_API_URL}?${params.toString()}`;
    const scrapflyResponse = await fetchWithTimeout(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }, FIRECRAWL_TIMEOUT);

    const ms = Date.now() - startTime;
    const result = scrapflyResponse.ok ? await scrapflyResponse.json() : null;

    if (!scrapflyResponse.ok) {
      const errorText = await scrapflyResponse.text().catch(() => "Unknown error");
      return {
        result: null,
        step: {
          provider: "scrapfly",
          status: "error",
          ms,
          code: scrapflyResponse.status,
          hint: `HTTP ${scrapflyResponse.status}: ${errorText}`,
        },
      };
    }

    // Transform Scrapfly result to match Firecrawl format
    const hasContent = result?.result?.content;
    let transformedResult = null;
    
    if (hasContent) {
      transformedResult = {
        success: true,
        data: {
          html: result.result.content,
          markdown: null, // Scrapfly doesn't provide markdown
          metadata: {
            title: result.result.title || undefined,
            description: result.result.description || undefined,
          }
        }
      };
    }
    
    return {
      result: transformedResult,
      step: {
        provider: "scrapfly",
        status: hasContent ? "ok" : "empty",
        ms,
        code: scrapflyResponse.status,
        ...(hasContent ? {} : { hint: "No content returned from Scrapfly" }),
      },
    };

  } catch (error) {
    const ms = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ Scrapfly error for ${url}:`, errorMessage);
    
    return {
      result: null,
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
 * Legacy wrapper to maintain compatibility
 */
async function callFirecrawl(
  url: string,
  apiKey: string,
  isSecondPass = false,
): Promise<{ result: unknown; step: ChainStep }> {
  const { result, steps } = await callFirecrawlWithRetries(url, apiKey, isSecondPass);
  return { result, step: steps[steps.length - 1] };
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
    
    // 1. Try Shopify JSON first (for Shopify product pages)
    const { result: shopifyResult, step: shopifyStep } = await tryShopifyJson(url);
    meta.chain.push(shopifyStep);
    
    let finalResult = shopifyResult;
    let data: any = {};
    let parsedRich: ParsedResult | null = shopifyResult;
    
    // Check if Shopify result looks thin
    const hasNumericDoses = shopifyStep.status === "ok" && !shopifyStep.hint?.includes("No numeric doses");
    const shopifyThin = looksThin(shopifyResult, hasNumericDoses);
    
    if (shopifyThin) {
      console.log(`📱 Shopify JSON was thin, trying Firecrawl...`);
      
      // 2. Fallback to Firecrawl
      const { result: firecrawlResult, steps: firecrawlSteps } = await callFirecrawlWithRetries(url, apiKey, false);
      meta.chain.push(...firecrawlSteps);

      finalResult = firecrawlResult;
      data = (firecrawlResult as any)?.data ?? {};
      parsedRich = null; // Will be parsed later
    } else {
      console.log(`✅ Shopify JSON provided good content`);
    }

    // Check if we need Scrapfly fallback (only if we used Firecrawl and it was thin)
    const firecrawlFailed = shopifyThin && (!finalResult || !(finalResult as any)?.success);
    const hasUsableContent = (data?.html || data?.markdown);
    const firecrawlThin = shopifyThin && firecrawlFailed || !hasUsableContent;
    
    if (firecrawlThin) {
      console.log(`🔄 Firecrawl failed or returned empty content, trying Scrapfly fallback...`);
      
      // Check for Scrapfly API key
      const scrapflyApiKey = Deno.env.get("SCRAPFLY_API_KEY");
      if (!scrapflyApiKey) {
        console.error("❌ SCRAPFLY_API_KEY environment variable is missing for fallback");
        return jsonResponse({
          error: "config",
          message: "SCRAPFLY_API_KEY missing for fallback",
          _meta: meta,
        }, 500);
      }

      const { result: scrapflyResult, step: scrapflyStep } = await callScrapfly(url, scrapflyApiKey);
      meta.chain.push(scrapflyStep);

      if (scrapflyResult) {
        finalResult = scrapflyResult;
        data = (scrapflyResult as any)?.data ?? {};
        console.log(`✅ Scrapfly fallback successful`);
      } else {
        console.log(`❌ Both Firecrawl and Scrapfly failed`);
      }
    }

    // 4. Parse the result (skip if we already have Shopify result)
    if (!parsedRich) {
      let html = typeof data?.html === 'string' ? data.html : '';
      let md = typeof data?.markdown === 'string' ? data.markdown : '';
      // parseProductPage prefers HTML; if only markdown exists, wrap it
      let htmlForParser = html || (md ? `<article>${md}</article>` : '');

      // get OCR key if present
      const OCRSPACE_API_KEY = Deno.env.get("OCRSPACE_API_KEY") || undefined;

      // Parse with first pass content
      parsedRich = await parseProductPage(htmlForParser, url, null, { OCRSPACE_API_KEY });
    }

    // Final thin content guard - if still thin after all providers, throw error
    const initialFactsTokens = countFactsTokens(
      parsedRich?.supplementFacts?.raw ??
      parsedRich?.supplement_facts ?? ''
    );
    if (looksThin(parsedRich, false, initialFactsTokens)) {
      throw new Error("Thin content – fallback failed");
    }

    // Check if we need second pass
    const factsTokens = countFactsTokens(parsedRich.supplement_facts || '');
    const shouldDoSecondPass = needsSecondPass(parsedRich, factsTokens);

    if (shouldDoSecondPass) {
      console.log(`🔄 Triggering second pass for ${url} (factsTokens: ${factsTokens})`);
      
      // Second pass with retries
      const { result: secondResult, steps: secondSteps } = await callFirecrawlWithRetries(url, apiKey, true);
      meta.chain.push(...secondSteps);

      if (secondResult) {
        // Re-parse with second pass content
        const secondData = (secondResult as any)?.data ?? {};
        const secondHtml = typeof secondData?.html === 'string' ? secondData.html : '';
        
        if (secondHtml) {
          parsedRich = await parseProductPage(secondHtml, url, null, { OCRSPACE_API_KEY });
        }
      }
      
      // Mark that we did a second pass
      meta.secondPass = true;
    }

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
    const finalFactsTokens = countFactsTokens(factsRaw);
    
    // Prepare warnings array with optional numeric doses concern
    let warnings = parsedRich.warnings && parsedRich.warnings.length
      ? [...parsedRich.warnings]
      : [];
    
    // Add concern for missing numeric doses if applicable
    if (!parsedRich.numeric_doses_present) {
      warnings.push("⚠ Numeric doses missing");
    }

    const out: SuccessResponse = {
      title: parsedRich.title || 'Unknown Product',
      ingredients: ingredientsArray,
      supplementFacts: factsRaw ? { raw: factsRaw } : undefined,
      warnings: warnings,
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
        had_numeric_doses: parsedRich._meta?.had_numeric_doses
      }
    };
    
    // Optional: Trim large review blobs server side
    if (out.supplementFacts?.raw) {
      out.supplementFacts.raw = stripReviewsBlob(out.supplementFacts.raw);
    }
    
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