// supabase/functions/firecrawl-extract/index.ts

/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    source: 'firecrawl-extract' | 'firecrawl-crawl' | 'scrapfly' | 'none' | 'error';
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
async function tryFirecrawlExtract(url: string, firecrawlKey: string): Promise<{ data: any | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const extractStart = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] Trying Firecrawl /extract...`);
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
          timeout: 10000 // 10s timeout for Firecrawl's internal process
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
async function tryFirecrawlCrawl(url: string, firecrawlKey: string): Promise<{ html: string | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const crawlStart = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] Trying Firecrawl /crawl...`);
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
          timeout: 20000 // 20s timeout for Firecrawl's internal process
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

// Helper for Scrapfly /scrape
async function tryScrapfly(url: string, scrapflyKey: string): Promise<{ html: string | null, status: 'success' | 'empty' | 'failed', httpStatus?: number }> {
  const scrapflyStart = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] Trying Scrapfly...`);
    const qs = new URLSearchParams({
      key: scrapflyKey,
      url: url,
      render_js: "true",
      asp: "true"
    });
    const scrapflyRes = await fetchWithTimeout(`https://api.scrapfly.io/scrape?${qs}`,
      {}, // No extra options for POST if using GET with query params
      30000 // 30s total network timeout for Scrapfly
    );

    const scrapflyTime = Date.now() - scrapflyStart;

    if (scrapflyRes.ok) {
      const data = await scrapflyRes.json(); // returns { result: { content: "<html…>" } }
      if (data?.result?.content) {
        console.log(`✅ [${scrapflyTime}ms] Scrapfly succeeded`);
        return { html: data.result.content as string, status: 'success', httpStatus: scrapflyRes.status };
      }
      console.log(`⚠️ [${scrapflyTime}ms] Scrapfly succeeded but no content`);
      return { html: null, status: 'empty', httpStatus: scrapflyRes.status };
    } else {
      console.warn(`❌ Scrapfly failed: ${scrapflyRes.status} ${scrapflyRes.statusText}`);
      const errorBody = await scrapflyRes.text();
      console.warn(`Scrapfly error details: ${errorBody.substring(0, 200)}...`); // Log first 200 chars
      return { html: null, status: 'failed', httpStatus: scrapflyRes.status };
    }
  } catch (error) {
    const scrapflyTime = Date.now() - scrapflyStart;
    console.warn(`❌ Scrapfly error after ${scrapflyTime}ms:`, error.message);
    return { html: null, status: 'failed', httpStatus: undefined };
  }
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

  let url: string;
  let forceScrapfly: boolean = false;
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
      const { data, status, httpStatus } = await tryFirecrawlExtract(url, firecrawlKey);
      meta.firecrawlExtractStatus = status;
      meta.firecrawlExtractMs = meta.timing.totalMs + (Date.now() - startTime); // Initial timing for this step
      meta.firecrawlExtractHttpStatus = httpStatus;

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
      const { html, status, httpStatus } = await tryFirecrawlCrawl(url, firecrawlKey);
      meta.firecrawlCrawlStatus = status;
      meta.firecrawlCrawlMs = (Date.now() - startTime) - (meta.firecrawlExtractMs || 0);
      meta.firecrawlCrawlHttpStatus = httpStatus;

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
      }
    }

    // --- Final Response ---
    meta.timing.totalMs = Date.now() - startTime;

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