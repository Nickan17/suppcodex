// supabase/functions/firecrawl-extract/index.ts

/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Simple fetch with timeout
async function fetchWithTimeout(resource: string, options: RequestInit = {}, timeout = 25000) { // Increased default timeout for external APIs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Helper to create consistent error responses
function errorResponse(message: string, status = 500, meta: any = {}) {
  return new Response(JSON.stringify({ 
    error: message,
    _meta: { 
      source: "error", 
      mode: "failed",
      timestamp: new Date().toISOString(),
      ...meta
    } 
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Simple response type for our extraction results
interface ExtractionResponse {
  data?: any; // For structured data from Firecrawl /extract
  html?: string; // For raw HTML/text from Firecrawl /crawl or Scrapfly
  error?: string;
  _meta: {
    source: 'firecrawl-extract' | 'firecrawl-crawl' | 'scrapfly' | 'scraperapi' | 'none' | 'error';
    firecrawlExtractStatus: 'success' | 'empty' | 'failed' | 'not_attempted';
    firecrawlCrawlStatus: 'success' | 'empty' | 'failed' | 'not_attempted';
    scrapflyStatus: 'success' | 'empty' | 'failed' | 'not_attempted';
    timing: {
      totalMs: number;
      firecrawlExtractMs?: number;
      firecrawlCrawlMs?: number;
      scrapflyMs?: number;
    };
    firecrawlExtractHttpStatus?: number;
    firecrawlCrawlHttpStatus?: number;
    scrapflyHttpStatus?: number;
    scraperApiStatus?: number;
    scraperApiMs?: number;
    scraperApiHttpStatus?: number;
    scraperApiBodySnippet?: string;
    /**
     * The proxy mode used for Firecrawl requests ("auto" by default, can be overridden by POST body).
     * "auto" will first try basic, then stealth if needed (higher Firecrawl credit cost).
     */
    proxyMode?: string;
  };
}


// Helper to create consistent responses
function createResponse(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

// Helper for Firecrawl /v1/extract
/**
 * Calls Firecrawl /v1/extract with proxy support.
 * @param url Target URL to extract
 * @param firecrawlKey API key
 * @param proxyMode Proxy mode string (default: "auto"). "auto" tries basic, then stealth if needed (higher credit cost)
 */
async function tryFirecrawlExtract(url: string, firecrawlKey: string, proxyMode: string = "auto"): Promise<{ data: any | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const extractStart = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] Trying Firecrawl /extract with proxy: ${proxyMode}`);
    const extractRes = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/extract",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: url, // Firecrawl extract takes 'url' not 'urls'
          timeout: 10000, // 10s timeout for Firecrawl's internal process
          proxy: proxyMode // Always send proxy
        }),
      },
      20000 // 20s total network timeout for this fetch
    );

    const extractTime = Date.now() - extractStart;

    if (extractRes.ok) {
      const data = await extractRes.json();
      if (data?.data?.content) { // Firecrawl /extract returns { data: { content: "..." } }
        console.log(`✅ [${extractTime}ms] Firecrawl /extract succeeded`);
        return { data: data.data, status: 'success', httpStatus: extractRes.status };
      }
      console.log(`⚠️ [${extractTime}ms] Firecrawl /extract succeeded but no content`);
      return { data: null, status: 'empty', httpStatus: extractRes.status };
    } else {
      console.warn(`❌ Firecrawl /extract failed: ${extractRes.status} ${extractRes.statusText}`);
      return { data: null, status: 'failed', httpStatus: extractRes.status };
    }
  } catch (error) {
    const extractTime = Date.now() - extractStart;
    console.warn(`❌ Firecrawl /extract error after ${extractTime}ms:`, error.message);
    return { data: null, status: 'failed', httpStatus: undefined };
  }
}


// Helper for Firecrawl /v1/crawl
/**
 * Calls Firecrawl /v1/crawl with proxy support.
 * @param url Target URL to crawl
 * @param firecrawlKey API key
 * @param proxyMode Proxy mode string (default: "auto"). "auto" tries basic, then stealth if needed (higher credit cost)
 */
async function tryFirecrawlCrawl(url: string, firecrawlKey: string, proxyMode: string = "auto"): Promise<{ html: string | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const crawlStart = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] Trying Firecrawl /crawl with proxy: ${proxyMode}`);
    const crawlRes = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/crawl",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: url, // Firecrawl crawl takes 'url' not 'urls'
          extractorOptions: { mode: "markdown" }, // Or "html", "text"
          timeout: 20000, // 20s timeout for Firecrawl's internal process
          proxy: proxyMode // Always send proxy
        }),
      },
      25000 // 25s total network timeout for this fetch
    );

    const crawlTime = Date.now() - crawlStart;

    if (crawlRes.ok) {
      const data = await crawlRes.json();
      if (data?.data?.content) { // Firecrawl /crawl returns { data: { content: "..." } }
        console.log(`✅ [${crawlTime}ms] Firecrawl /crawl succeeded`);
        return { html: data.data.content, status: 'success', httpStatus: crawlRes.status };
      }
      console.log(`⚠️ [${crawlTime}ms] Firecrawl /crawl succeeded but no content`);
      return { html: null, status: 'empty', httpStatus: crawlRes.status };
    } else {
      console.warn(`❌ Firecrawl /crawl failed: ${crawlRes.status} ${crawlRes.statusText}`);
      return { html: null, status: 'failed', httpStatus: crawlRes.status };
    }
  } catch (error) {
    const crawlTime = Date.now() - crawlStart;
    console.warn(`❌ Firecrawl /crawl error after ${crawlTime}ms:`, error.message);
    return { html: null, status: 'failed', httpStatus: undefined };
  }
}


// --- Scrapfly fetch settings ---
const SCRAPFLY_TIMEOUT_MS = 15000; // 15 seconds

// Helper for Scrapfly /scrape
async function tryScrapfly(url: string, scrapflyKey: string): Promise<{ html: string | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const scrapflyStart = Date.now();
  console.log(`[Scrapfly] Fetching ${url} with timeout ${SCRAPFLY_TIMEOUT_MS}ms...`);
  try {
    const qs = new URLSearchParams({
      key: scrapflyKey,
      url: url,
      render_js: "true",
      asp: "true"
    });
    const scrapflyRes = await fetchWithTimeout(
      `https://api.scrapfly.io/scrape?${qs}`,
      {},
      SCRAPFLY_TIMEOUT_MS // Use constant for timeout
    );
    const scrapflyTime = Date.now() - scrapflyStart;
    if (scrapflyRes.ok) {
      const data = await scrapflyRes.json();
      if (data?.result?.content) {
        console.log(`[Scrapfly] Request finished in ${scrapflyTime}ms with status: ${scrapflyRes.status}`);
        return { html: data.result.content as string, status: 'success', httpStatus: scrapflyRes.status };
      }
      console.log(`[Scrapfly] Request finished in ${scrapflyTime}ms but no content (status: ${scrapflyRes.status})`);
      return { html: null, status: 'empty', httpStatus: scrapflyRes.status };
    } else {
      const errorBody = await scrapflyRes.text();
      console.error(`[Scrapfly] ERROR after ${scrapflyTime}ms: ${scrapflyRes.status} ${scrapflyRes.statusText}`);
      console.error(`[Scrapfly] Error details: ${errorBody.substring(0, 200)}...`);
      return { html: null, status: 'failed', httpStatus: scrapflyRes.status };
    }
  } catch (error) {
    const scrapflyTime = Date.now() - scrapflyStart;
    console.error(`[Scrapfly] ERROR after ${scrapflyTime}ms:`, error.message);
    return { html: null, status: 'failed', httpStatus: undefined };
  }
}

// Helper to parse basic product data from HTML
function parseProductPage(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  // Title
  const title =
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ??
    doc.querySelector("title")?.textContent?.trim() ??
    null;

  // Very naive ingredient grab: first <p> or <li> containing “ingredient”
  const ingredientNode = [...doc.querySelectorAll("p, li")]
    .find(el => /ingredient/i.test(el.textContent || ""));
  const ingredients = ingredientNode?.textContent?.trim() ?? null;

  return { title, ingredients };
}
// Main request handler
serve(async (req) => {
  const startTime = Date.now();
  const meta: ExtractionResponse['_meta'] = {
    source: 'none',
    firecrawlExtractStatus: 'not_attempted',
    firecrawlCrawlStatus: 'not_attempted',
    scrapflyStatus: 'not_attempted',
    timing: { totalMs: 0 }
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Bypass authentication for now
  // const authHeader = req.headers.get('Authorization');
  // if (!authHeader) {
  //   return errorResponse('Missing authorization header', 200, meta);
  // }

  let url: string;
  let forceScrapfly: boolean = false;
  let proxyMode: string = "auto"; // Default proxy mode is 'auto', can be overridden by POST body
  let body;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method Not Allowed', 405, meta);
    }
    try {
      body = await req.json();
    } catch (err) {
      console.error("Failed to parse JSON body:", err.message);
      return errorResponse('Invalid JSON in request body', 400, meta);
    }
    console.log("Request body:", body);

    url = body?.url;
    forceScrapfly = !!body.forceScrapfly || !!body.scrapfly;
    // Proxy mode: allow override via POST body, default to 'auto' if not provided
    if (typeof body?.proxy === "string") {
      proxyMode = body.proxy;
    }

    // Also check query params if you want:
    const urlParams = new URL(req.url).searchParams;
    if (urlParams.get('forceScrapfly') === 'true' || urlParams.get('scrapfly') === 'true') {
      forceScrapfly = true;
    }

    console.log("Parsed url:", url);
    if (!url) {
      return errorResponse('URL is required', 400, meta);
    }

    // Get API Keys
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const scrapflyKey = Deno.env.get("SCRAPFLY_API_KEY");

    if (!firecrawlKey && !forceScrapfly) { // Firecrawl is primary, warn if no key and not forcing Scrapfly
        console.warn("FIRECRAWL_API_KEY is not set. Will try Scrapfly if possible.");
    }
    if (!scrapflyKey) { // Scrapfly is fallback, it must be set.
        return errorResponse('SCRAPFLY_API_KEY is not set. Fallback will not work.', 500, meta);
    }

    console.log(`[${new Date().toISOString()}] Starting extraction for: ${url}`);
    if (forceScrapfly) {
        console.log(`[${new Date().toISOString()}] Force Scrapfly mode activated.`);
    }

    let extractedData: any | null = null; // For Firecrawl /extract structured data
    let extractedHtml: string | null = null; // For raw HTML/Markdown from crawl or Scrapfly

    // 1. Try Firecrawl /v1/extract first (unless forceScrapfly is true or Firecrawl key is missing)
    if (!forceScrapfly && firecrawlKey) {
      const { data, status, httpStatus } = await tryFirecrawlExtract(url, firecrawlKey, proxyMode);
      meta.firecrawlExtractStatus = status;
      meta.firecrawlExtractMs = meta.timing.totalMs + (Date.now() - startTime); // Initial timing for this step
      meta.firecrawlExtractHttpStatus = httpStatus;
      meta.proxyMode = proxyMode; // Log which proxy mode was used

      if (status === 'success' && data) {
        extractedData = data;
        meta.source = 'firecrawl-extract';
      }
    } else if (forceScrapfly) {
        meta.firecrawlExtractStatus = 'not_attempted';
        meta.firecrawlCrawlStatus = 'not_attempted'; // Ensure crawl also marked not attempted if forced
    }

    // 2. If no structured data from extract, try Firecrawl /v1/crawl (unless forceScrapfly is true or Firecrawl key is missing)
    if (!extractedData && !forceScrapfly && firecrawlKey) {
      const { html, status, httpStatus } = await tryFirecrawlCrawl(url, firecrawlKey, proxyMode);
      meta.firecrawlCrawlStatus = status;
      meta.firecrawlCrawlMs = (Date.now() - startTime) - (meta.firecrawlExtractMs || 0);
      meta.firecrawlCrawlHttpStatus = httpStatus;
      meta.proxyMode = proxyMode; // Log which proxy mode was used (also for crawl)

      if (status === 'success' && html) {
        extractedHtml = html;
        meta.source = 'firecrawl-crawl';
      }
    }

    // 3. If still no content, fallback to Scrapfly
    if (!extractedData && !extractedHtml) {
      const { html, status, httpStatus } = await tryScrapfly(url, scrapflyKey as string); // Cast as string since we checked for existence above
      meta.scrapflyStatus = status;
      meta.scrapflyMs = (Date.now() - startTime) - ((meta.firecrawlExtractMs || 0) + (meta.firecrawlCrawlMs || 0));
      meta.scrapflyHttpStatus = httpStatus;

      if (status === 'success' && html) {
        extractedHtml = html;
        meta.source = 'scrapfly';
        console.log("[DEBUG] Scrapfly html length:", html.length);
      }
    }

    // 4. If still no content, fallback to ScraperAPI
    if (!extractedData && !extractedHtml) {
      const scraperApiKey = Deno.env.get("SCRAPERAPI_KEY");
      if (scraperApiKey) {
        console.log(`[${new Date().toISOString()}] [ScraperAPI] Attempting fallback for ${url}`);
        try {
          const apiUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&render=true`;
          const scraperStart = Date.now();
          const scraperRes = await fetchWithTimeout(apiUrl, {}, 60000);
          const scraperBody = await scraperRes.text();
          const snippet = scraperBody.substring(0, 300).replace(/\n/g, " ");
          console.log(`[ScraperAPI] Status: ${scraperRes.status}, Body snippet: ${snippet}`);
          meta.scraperApiStatus = scraperRes.status;
          meta.scraperApiMs = Date.now() - scraperStart;
          meta.scraperApiHttpStatus = scraperRes.status;
          meta.scraperApiBodySnippet = scraperBody.slice(0, 300);

          // Log verbose details on failure
          if (!scraperRes.ok) {
            console.error(`[ScraperAPI] ERROR ${scraperRes.status}: ${scraperBody.slice(0,300).replace(/\n/g,' ')}`);
          }
          if (scraperRes.ok && scraperBody && scraperBody.length > 1000) {
            extractedHtml = scraperBody;
            meta.source = "scraperapi";
          }
        } catch (err) {
          console.error(`[ScraperAPI] ERROR:`, err.message);
        }
      } else {
        console.warn("[ScraperAPI] SCRAPERAPI_KEY not set in environment.");
>>>>>>> e42ba0e (feat: Add structured extraction (title, ingredients) to firecrawl-extract with deno_dom)
      }
    }

    // --- Final Response ---
    meta.timing.totalMs = Date.now() - startTime;

<<<<<<< HEAD
    if (extractedData) { // Prioritize structured data from Firecrawl /extract
      console.log(`[${new Date().toISOString()}] Successfully extracted structured data via ${meta.source}`);
      return createResponse({
        data: extractedData,
        _meta: meta
      });
    } else if (extractedHtml) { // Fallback to raw HTML/Markdown
      console.log(`[${new Date().toISOString()}] Successfully extracted raw content via ${meta.source}`);
      return createResponse({
        html: extractedHtml,
        _meta: meta
      });
    } else {
      // If all methods failed
      console.error(`❌ [${new Date().toISOString()}] All extraction methods failed for ${url}`);
      return errorResponse(
        "No content extracted from target URL after trying all methods",
        502, // 502 Bad Gateway/Proxy Error - indicates upstream issue
        meta
=======
    // --- Final Response ---
    meta.timing.totalMs = Date.now() - startTime;

    // Always log final meta for debugging
    console.log("[DEBUG] Final meta before response:", JSON.stringify(meta, null, 2));

    if (extractedData) {                // structured Firecrawl data
      console.log(`[${new Date().toISOString()}] Structured data extracted via ${meta.source}`);
      return createResponse({ data: extractedData, _meta: meta });
    } else if (extractedHtml) {
      // Parse basic fields
      const parsed = parseProductPage(extractedHtml);
      console.log(`[${new Date().toISOString()}] Raw content extracted via ${meta.source}`);
      return createResponse({
        html: extractedHtml,
        parsed,          // <-- new structured object
        _meta: meta
      });
    } else {                            // all methods failed
      console.error(`❌ [${new Date().toISOString()}] All extraction methods FAILED for ${url}`);
      return createResponse(
        { error: "No content extracted from target URL after trying all methods", _meta: meta },
        502
>>>>>>> e42ba0e (feat: Add structured extraction (title, ingredients) to firecrawl-extract with deno_dom)
      );
    }
    
  } catch (error) {
    // Global error handler for any unexpected issues
    meta.timing.totalMs = Date.now() - startTime;
    console.error(`🔥 [${new Date().toISOString()}] Unhandled error:`, error.message);
    
    return errorResponse(
      `An unexpected error occurred: ${error.message}`,
      500,
      meta
    );
  }
});