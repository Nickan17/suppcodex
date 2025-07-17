// supabase/functions/firecrawl-extract/index.ts

// @ts-ignore - Deno types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { validateEnvironmentOrThrow } from "../_shared/env-validation.ts";

// ADDED: Validate environment at startup - fail fast if misconfigured
const ENV_CONFIG = validateEnvironmentOrThrow();

// Simple fetch with timeout
async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout = 25000,
) { // Increased default timeout for external APIs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Helper to create consistent error responses
function errorResponse(message: string, status = 500, meta: any = {}) {
  return new Response(
    JSON.stringify({
      error: message,
      _meta: {
        source: "error",
        mode: "failed",
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Simple response type for our extraction results
interface ExtractionResponse {
  data?: any; // For structured data from Firecrawl /extract
  html?: string; // For raw HTML/text from Firecrawl /crawl or Scrapfly
  error?: string;
  _meta: {
    source:
      | "firecrawl-extract"
      | "firecrawl-crawl"
      | "scrapfly"
      | "scraperapi"
      | "none"
      | "error";
    firecrawlExtractStatus: "success" | "empty" | "failed" | "not_attempted";
    firecrawlCrawlStatus: "success" | "empty" | "failed" | "not_attempted";
    scrapflyStatus: "success" | "empty" | "failed" | "not_attempted";
    timing: {
      totalMs: number;
      firecrawlExtractMs?: number;
      firecrawlCrawlMs?: number;
      scrapflyMs?: number;
      scraperApiMs?: number;
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
function createResponse(
  data: any,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

// Helper for Firecrawl /v1/extract
/**
 * Calls Firecrawl /v1/extract with proxy support.
 * @param url Target URL to extract
 * @param firecrawlKey API key
 * @param proxyMode Proxy mode string (default: "auto"). "auto" tries basic, then stealth if needed (higher credit cost)
 */
async function tryFirecrawlExtract(
  url: string,
  firecrawlKey: string,
  proxyMode: string = "auto",
): Promise<
  {
    data: any | null;
    status: "success" | "empty" | "failed";
    httpStatus?: number;
  }
> {
  const extractStart = Date.now();
  try {
    console.log(
      `[${
        new Date().toISOString()
      }] Trying Firecrawl /extract with proxy: ${proxyMode}`,
    );
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
          proxy: proxyMode, // Always send proxy
        }),
      },
      20000, // 20s total network timeout for this fetch
    );

    const extractTime = Date.now() - extractStart;

    if (extractRes.ok) {
      const data = await extractRes.json();
      if (data?.data?.content) { // Firecrawl /extract returns { data: { content: "..." } }
        console.log(`✅ [${extractTime}ms] Firecrawl /extract succeeded`);
        return {
          data: data.data,
          status: "success",
          httpStatus: extractRes.status,
        };
      }
      console.log(
        `⚠️ [${extractTime}ms] Firecrawl /extract succeeded but no content`,
      );
      return { data: null, status: "empty", httpStatus: extractRes.status };
    } else {
      console.warn(
        `❌ Firecrawl /extract failed: ${extractRes.status} ${extractRes.statusText}`,
      );
      return { data: null, status: "failed", httpStatus: extractRes.status };
    }
  } catch (error: unknown) {
    const extractTime = Date.now() - extractStart;
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(`[Firecrawl] Error in extract (${proxyMode}):`, errorMessage);
    return { data: null, status: "failed", httpStatus: 500 };
  }
}

// Helper for Firecrawl /v1/crawl
/**
 * Calls Firecrawl /v1/crawl with proxy support.
 * @param url Target URL to crawl
 * @param firecrawlKey API key
 * @param proxyMode Proxy mode string (default: "auto"). "auto" tries basic, then stealth if needed (higher credit cost)
 */
async function tryFirecrawlCrawl(
  url: string,
  firecrawlKey: string,
  proxyMode: string = "auto",
): Promise<
  {
    html: string | null;
    status: "success" | "empty" | "failed";
    httpStatus?: number;
  }
> {
  const crawlStart = Date.now();
  try {
    console.log(
      `[${
        new Date().toISOString()
      }] Trying Firecrawl /crawl with proxy: ${proxyMode}`,
    );
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
          proxy: proxyMode, // Always send proxy
        }),
      },
      25000, // 25s total network timeout for this fetch
    );

    const crawlTime = Date.now() - crawlStart;

    if (crawlRes.ok) {
      const data = await crawlRes.json();
      if (data?.data?.content) { // Firecrawl /crawl returns { data: { content: "..." } }
        console.log(`✅ [${crawlTime}ms] Firecrawl /crawl succeeded`);
        return {
          html: data.data.content,
          status: "success",
          httpStatus: crawlRes.status,
        };
      }
      console.log(
        `⚠️ [${crawlTime}ms] Firecrawl /crawl succeeded but no content`,
      );
      return { html: null, status: "empty", httpStatus: crawlRes.status };
    } else {
      console.warn(
        `❌ Firecrawl /crawl failed: ${crawlRes.status} ${crawlRes.statusText}`,
      );
      return { html: null, status: "failed", httpStatus: crawlRes.status };
    }
  } catch (error) {
    const crawlTime = Date.now() - crawlStart;
    console.warn(
      `❌ Firecrawl /crawl error after ${crawlTime}ms:`,
      (error as Error).message,
    );
    return { html: null, status: "failed", httpStatus: undefined };
  }
}

// --- Scrapfly fetch settings ---
const SCRAPFLY_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Calls OCR.Space API to extract text from an image
 */
interface OCRSpaceResponse {
  ParsedResults?: Array<{
    ParsedText?: string;
  }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string;
  ErrorDetails?: string[];
}

async function ocrSpaceImage(imageUrl: string): Promise<string | null> {
  // IMPROVED: Use validated environment config
  const apiKey = ENV_CONFIG.OCRSPACE_API_KEY;

  if (!apiKey) {
    console.warn(
      "[OCR] OCRSPACE_API_KEY is not set - OCR functionality will be disabled",
    );
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("url", imageUrl);
    formData.append("apikey", apiKey);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("isTable", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // 1 = Legacy, 2 = New

    const response = await fetchWithTimeout(
      "https://api.ocr.space/parse/image",
      {
        method: "POST",
        body: formData,
        headers: {
          "apikey": apiKey,
        },
      },
      10000,
    ); // 10-second timeout for OCR

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OCR API error: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    const data = await response.json() as OCRSpaceResponse;

    if (data.IsErroredOnProcessing) {
      const errorDetails = Array.isArray(data.ErrorDetails)
        ? data.ErrorDetails.join("; ")
        : (data.ErrorDetails ?? "");
      throw new Error(
        `OCR processing error: ${data.ErrorMessage || "Unknown error"}${
          errorDetails ? ` (${errorDetails})` : ""
        }`,
      );
    }

    if (data?.ParsedResults?.[0]?.ParsedText) {
      return data.ParsedResults[0].ParsedText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    return null;
  } catch (error: unknown) {
    console.error(
      "[OCR] Error in ocrSpaceImage:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

// Type guard for error handling
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

/**
 * Checks if a string looks like an ingredient list
 */
function looksLikeIngredientList(text: string | null): boolean {
  if (!text) return false;

  const normalized = text.toLowerCase();

  // Check for common ingredient list indicators
  const hasIngredients =
    /ingredients?:|medicinal ingredients?|non[- ]?medicinal|supplement facts/i
      .test(normalized);
  const hasListMarkers = /[\w\s]+,|•|\*|\d+\./g.test(normalized);
  const hasMultipleLines = normalized.includes("\n") ||
    normalized.includes("\r");

  // Check for common ingredient list patterns
  const hasIngredientPatterns =
    /(?:^|\s)(?:\d+[\s\w/]+(?:\s*[\-–]\s*\d+[\s\w/]+)?%?\s*[a-zA-Z]+(?:\s+[a-zA-Z]+)*|\b(?:organic|natural|vegan|gluten-free|non-gmo|kosher|halal|usda|fda)\b)/i
      .test(normalized);

  return (hasIngredients || hasListMarkers || hasIngredientPatterns) &&
    (hasMultipleLines || normalized.length > 100);
}

/**
 * Helper for Scrapfly /scrape
 */
async function tryScrapfly(
  url: string,
  scrapflyKey: string,
): Promise<
  {
    html: string | null;
    status: "success" | "empty" | "failed";
    httpStatus?: number;
  }
> {
  const scrapflyStart = Date.now();
  console.log(
    `[Scrapfly] Fetching ${url} with timeout ${SCRAPFLY_TIMEOUT_MS}ms...`,
  );
  try {
    const qs = new URLSearchParams({
      key: scrapflyKey,
      url: url,
      render_js: "true",
      asp: "true",
      ocr: "true", // Enable Scrapfly's OCR engine
    });
    const scrapflyRes = await fetchWithTimeout(
      `https://api.scrapfly.io/scrape?${qs}`,
      {},
      SCRAPFLY_TIMEOUT_MS, // Use constant for timeout
    );
    const scrapflyTime = Date.now() - scrapflyStart;

    // Peek at the HTML that Scrapfly returned (safe clone)
    const rawJson = await scrapflyRes.clone().json().catch(() => null);
    const htmlSnippet = rawJson?.result?.content?.slice?.(0, 500) ??
      "[no result.content]";
    // Scrapfly request completed

    if (scrapflyRes.ok) {
      const data = await scrapflyRes.json();
      if (data?.result?.content) {
        console.log(
          `[Scrapfly] Request finished in ${scrapflyTime}ms with status: ${scrapflyRes.status}`,
        );
        return {
          html: data.result.content as string,
          status: "success",
          httpStatus: scrapflyRes.status,
        };
      }
      console.log(
        `[Scrapfly] Request finished in ${scrapflyTime}ms but no content (status: ${scrapflyRes.status})`,
      );
      return { html: null, status: "empty", httpStatus: scrapflyRes.status };
    } else {
      const errorBody = await scrapflyRes.text();
      console.error(
        `[Scrapfly] ERROR after ${scrapflyTime}ms: ${scrapflyRes.status} ${scrapflyRes.statusText}`,
      );
      console.error(
        `[Scrapfly] Error details: ${errorBody.substring(0, 200)}...`,
      );
      return { html: null, status: "failed", httpStatus: scrapflyRes.status };
    }
  } catch (error) {
    const scrapflyTime = Date.now() - scrapflyStart;
    console.error(
      `[Scrapfly] ERROR after ${scrapflyTime}ms:`,
      (error as Error).message,
    );
    return { html: null, status: "failed", httpStatus: undefined };
  }
}

function cleanText(text: string | null) {
  return text?.replace(/\s+/g, " ").trim() ?? null;
}

function findIngredients(doc: any): string | null {
  // Look into ProductInfo / product-single__description sections (Shopify)
  const selectors = [
    "#ProductInfo .rte p",
    "#ProductInfo .rte li",
    ".product-single__description p",
    ".product-single__description li",
  ];

  for (const sel of selectors) {
    const node = doc.querySelector(sel);
    if (node && /ingredient/i.test(node.textContent || "")) {
      return cleanText(node.textContent);
    }
  }

  // Fallback: first p/li containing "ingredient"
  const elements = doc.querySelectorAll("p, li, div, span");
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const text = element.textContent || "";
    if (/ingredient/i.test(text)) {
      return cleanText(text);
    }
  }

  return null;
}

// --- improved tryImageOCR ------------------------------------------
/**
 * Shopify image URLs can have funny variants. This function tries to strip
 * them off so we’re left with the basic, original URL.
 *
 * @example
 * //cdn.shopify.com/s/files/1/0267/9243/7883/products/quattro-vanilla_2048x.png?v=1649275777
 * ↓
 * //cdn.shopify.com/s/files/1/0267/9243/7883/products/quattro-vanilla.png
 */
function normalizeShopifyUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("//") ? "https:" + url : url);
    if (
      !u.hostname.endsWith("cdn.shopify.com") &&
      !u.hostname.endsWith("magnumsupps.com")
    ) return url;

    // Strip size-related suffixes like _2048x, _large, etc.
    u.pathname = u.pathname.replace(
      /(_\d+x\d*|\.pico|\.icon|\.thumb|\.small|\.compact|\.medium|\.large|\.grande|\.original|_\d+x|x\d+)/i,
      "",
    );
    // Strip version parameter
    u.searchParams.delete("v");

    return u.toString().replace(/^https?:/, ""); // Return protocol-relative URL
  } catch {
    return url; // Return original URL on parse error
  }
}

/**
 * Shopify CDN lets you request smaller variants simply by changing the
 * “_2048x” (or similar) token or by appending ?width=N.  We use that to
 * make sure the image stays < 1 MB, below OCR.Space’s limit.
 */
function downsizeShopify(url: string, maxSide = 1200): string {
  try {
    const u = new URL(url.startsWith("//") ? "https:" + url : url);

    if (
      !u.hostname.includes("cdn.shopify.com") &&
      !u.hostname.includes("magnumsupps.com")
    ) return url;

    // Replace “…_2048x2048.” or “…_2048x.” with “…_1200x.”
    u.pathname = u.pathname.replace(/_(\d+x\d+)?\./, `_${maxSide}x.`);
    // Fallback: add explicit width param if absent
    if (!u.searchParams.has("width")) {
      u.searchParams.set("width", String(maxSide));
    }

    return u.toString();
  } catch {
    return url;
  }
}

// --- improved tryImageOCR ------------------------------------------
function scoreCandidate(text: string): number {
  const t = text.toLowerCase();

  // Hard‑require the keyword “ingredient” (or multilingual forms)
  if (!/ingredients?:/i.test(t)) return 0;

  let score = 0;
  if ((t.match(/,/g) || []).length >= 3) score += 2; // comma‑separated list
  if (/\b(mg|mcg|g|iu|%dv)\b/i.test(t)) score += 1; // dosage units
  if (/\([^()]*allergen/i.test(t)) score += 1; // allergen warnings
  if (/(organic|natural|artificial|color|flavor)/i.test(t)) score += 1; // label keywords

  // Penalize marketing fluff
  if (/(legacy|award|smooth|experience|delicious|premium)/i.test(t)) score -= 2;

  return score;
}

async function tryImageOCR(
  html: string,
  pageUrl?: string,
): Promise<string | null> {
  try {
    const MAX_OCR = 12;
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      console.log("[OCR] DOMParser returned null");
      return null;
    }

    const allOcrTexts: string[] = [];

    // 1. collect raw image candidates
    const rawImgs = Array.from(doc.querySelectorAll("img"));
    const getAlt = (img: Element) =>
      (img.getAttribute("alt") || img.getAttribute("data-alt") || "")
        .toLowerCase();

    const PANEL_TOKENS = {
      strong: /supplement\s*facts|amino\s*acid\s*profile|nutrition\s*facts/i,
      weak: /medicinal\s*ingredients?|non[- ]?medicinal|ingredients?/i,
    };

    const ranked = Array.from(
      rawImgs.map((img: any) => {
        const url = normalizeShopifyUrl(
          (
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            (img.getAttribute("srcset") || "").split(",")[0].trim().split(
              " ",
            )[0] ||
            ""
          ).replace(/^https?:/, ""),
        );
        if (!/\.(jpe?g|png|webp)/i.test(url)) return null;

        const alt = getAlt(img);
        const strong = PANEL_TOKENS.strong.test(url) ||
          PANEL_TOKENS.strong.test(alt);
        const weak = PANEL_TOKENS.weak.test(url) || PANEL_TOKENS.weak.test(alt);

        let score = 1;
        if (strong) score = 20;
        else if (weak) score = 10;
        return { url, score };
      })
        .filter(Boolean)
        // dedupe identical URLs
        .reduce((m, o) => m.has(o!.url) ? m : m.set(o!.url, o), new Map())
        .values(),
    )
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, MAX_OCR);

    console.log("[OCR] Ranked URLs:", ranked);

    // ── C) attempt OCR on top N ──
    for (const { url, score } of ranked) {
      let imgUrl = url.startsWith("//") ? `https:${url}` : url;
      if (pageUrl && imgUrl.startsWith("/")) {
        imgUrl = new URL(imgUrl, pageUrl).href;
      }
      console.log(`[OCR] trying image (score ${score}):`, imgUrl);

      // shrink oversize Shopify images so OCR.Space doesn’t throw E214
      imgUrl = downsizeShopify(imgUrl, 1200);
      console.log("[OCR] after downsize:", imgUrl);

      let txt: string | null = null;
      try {
        txt = await ocrSpaceImage(imgUrl);
      } catch (e) {
        if (String(e).includes("E214")) {
          console.log("[OCR] E214 – retrying with 800 px");
          txt = await ocrSpaceImage(downsizeShopify(imgUrl, 800));
        } else {
          throw e;
        }
      }
      if (!txt) {
        console.log("[OCR] empty OCR result");
        continue;
      }

      console.log("[OCR] raw OCR length:", txt.length);
      const ocrScore = scoreCandidate(txt);
      if (ocrScore >= 2) {
        console.log("[OCR] SUCCESS – valid OCR based on score", ocrScore);
        return txt;
      } else {
        console.log("[OCR] Rejected – low OCR score", ocrScore, "→ text was:");
        console.log(txt.slice(0, 300));
        allOcrTexts.push(txt);
      }
    }

    console.log(
      "[OCR] No valid ingredient OCR found, running full fallback over all images",
    );

    const allUniqueImgs = Array.from(
      rawImgs.map((img: any) => {
        const url = normalizeShopifyUrl(
          (
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            (img.getAttribute("srcset") || "").split(",")[0].trim().split(
              " ",
            )[0] ||
            ""
          ).replace(/^https?:/, ""),
        );
        if (!/\.(jpe?g|png|webp)/i.test(url)) return null;
        return { url };
      })
        .filter(Boolean)
        .reduce((m, o) => m.has(o!.url) ? m : m.set(o!.url, o), new Map())
        .values(),
    );

    for (const { url } of allUniqueImgs) {
      let imgUrl = url.startsWith("//") ? `https:${url}` : url;
      if (pageUrl && imgUrl.startsWith("/")) {
        imgUrl = new URL(imgUrl, pageUrl).href;
      }
      console.log(`[OCR] trying fallback image:`, imgUrl);

      imgUrl = downsizeShopify(imgUrl, 1200);
      console.log("[OCR] after downsize (fallback):", imgUrl);

      let txt: string | null = null;
      try {
        txt = await ocrSpaceImage(imgUrl);
      } catch (e) {
        if (String(e).includes("E214")) {
          console.log("[OCR] E214 – retrying with 800 px (fallback)");
          txt = await ocrSpaceImage(downsizeShopify(imgUrl, 800));
        } else {
          throw e;
        }
      }
      if (!txt) {
        console.log("[OCR] empty OCR result (fallback)");
        continue;
      }

      console.log("[OCR] raw OCR length (fallback):", txt.length);
      const ocrFallbackScore = scoreCandidate(txt);
      if (ocrFallbackScore >= 2) {
        console.log(
          `[OCR] Fallback accepted (score ${ocrFallbackScore}): ${imgUrl}`,
        );
        console.log(txt.slice(0, 300));
        return txt;
      } else {
        console.log(
          `[OCR] Fallback rejected (score ${ocrFallbackScore}) – text was:`,
        );
        console.log(txt.slice(0, 300));
      }
      allOcrTexts.push(txt); // Collect all OCR outputs
    }

    // Final fallback: Search the longest OCR output for "ingredients:".
    if (allOcrTexts.length > 0) {
      const longestOcrText = allOcrTexts.reduce((a, b) =>
        a.length > b.length ? a : b
      );
      const match = longestOcrText.match(/ingredients?:([\s\S]{0,400})/i);

      if (match) {
        const result = `Ingredients:${
          match[1].split("\n").slice(0, 3).join("\n")
        }`.trim();
        console.log(
          "[OCR] ingredients block fallback identified:",
          result.slice(0, 250),
        );
        return result;
      }
    }

    console.log(
      "[OCR] all candidates exhausted, nothing looked like ingredients",
    );
    return null;
  } catch (err) {
    console.error("[OCR] Fatal in tryImageOCR:", err);
    return null;
  }
}
// -------------------------------------------------------------------

interface ParsedProduct {
  title: string | null;
  ingredients_raw: string | null;
  numeric_doses_present: boolean;
  ocr_fallback_log?: string;
  ingredients?: string[];
  allergens?: string[];
  warnings?: string[];
  manufacturer?: string;
  [key: string]: unknown;
}
async function parseProductPage(
  html: string,
  pageUrl?: string,
): Promise<ParsedProduct> {
  const MAX_HTML_LEN = 400_000;
  if (html.length > MAX_HTML_LEN) html = html.slice(0, MAX_HTML_LEN);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    return {
      title: null,
      ingredients_raw: null,
      numeric_doses_present: false,
      ingredients: [],
      allergens: [],
      warnings: [],
      manufacturer: "",
    };
  }

  const title =
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ??
      cleanText(doc.querySelector("title")?.textContent ?? null);

  let ingredients: string | null = null;
  let numericDoses = false;
  let extra: Record<string, unknown> = {};

  // --- 1) Look inside every <script type="application/ld+json"> ---
  for (
    const script of doc.querySelectorAll('script[type="application/ld+json"]')
  ) {
    try {
      const json = JSON.parse(script.textContent || "");
      // Shopify's product object
      if (json?.description) {
        const tmp = new DOMParser().parseFromString(
          json.description,
          "text/html",
        );
        const txt = tmp?.textContent || "";
        const hit = txt.split(/[\n\r]+/)
          .map(cleanText)
          .find(looksLikeIngredientList);
        if (hit) {
          ingredients = cleanText(hit);
          break;
        }
      }
      // Rare "nutrition" block
      if (json?.nutrition?.ingredients) {
        ingredients = cleanText(json.nutrition.ingredients);
        break;
      }
    } catch { /* ignore bad JSON */ }
  }

  // gather every visible node that MIGHT be an ingredient list
  const candidates: string[] = [];
  doc.querySelectorAll(
    '[id*="ingredient" i],[class*="ingredient" i], .rte p, .rte li, p, li',
  ).forEach((el) => {
    const txt = cleanText(el.textContent);
    if (txt && txt.length > 30 && /ingredient/i.test(txt)) candidates.push(txt);
  });

  // choose best‑scored candidate
  let best = "";
  let bestScore = 0;
  for (const c of candidates) {
    const s = scoreCandidate(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (bestScore >= 2) {
    ingredients = best;
    // Selected best ingredient candidate
  }

  // --- 3) Legacy fallback selectors ---
  if (!ingredients) ingredients = findIngredients(doc);

  // --- 3) Try the Shopify.current_product assignment blob ---
  if (!ingredients) {
    const m = html.match(/Shopify\\.current_product\\s*=\\s*({[\s\S]+?});/);
    if (m) {
      try {
        const json = JSON.parse(m[1]);
        if (json?.content) {
          const tmp = new DOMParser().parseFromString(
            json.content,
            "text/html",
          );
          const txt = tmp?.textContent || "";
          const hit = txt.split(/[\n\r]+/)
            .map(cleanText)
            .find(looksLikeIngredientList);
          if (hit) ingredients = cleanText(hit);
        }
      } catch { /* ignore parse errors */ }
    }
  }

  // --- final regex sweep over raw HTML ---
  if (!ingredients) {
    const m = html.match(/ingredients?:\s*([^<]{30,400})/i);
    if (m) ingredients = cleanText(m[0]);
  }

  if (ingredients) {
    const tooShort = ingredients.length < 30;
    const marketing = /magnum|science|results|quality|legacy blend/i.test(
      ingredients,
    );
    const noComma = !/,/.test(ingredients); // real lists almost always have commas
    const noNumbers = !/\d/.test(ingredients);

    if (tooShort || (marketing && noComma && noNumbers)) {
      ingredients = null; // treat as bogus so we fall through to OCR
    }
  }

  // Candidate has no numbers → forcing OCR
  if (ingredients && !/\d/.test(ingredients)) {
    // No numeric doses found, trying OCR fallback
    ingredients = null;
  }

  // If no ingredients found through normal parsing, try OCR
  if (!ingredients) {
    console.log("[ING-DEBUG] No ingredients found, trying OCR...");
    const ocrResult = await tryImageOCR(html, pageUrl);
    if (ocrResult) {
      console.log("[ING-DEBUG] Found ingredients via OCR");
      ingredients = ocrResult;
      // The log message is no longer returned, so this check is removed.
    } else {
      console.log("[ING-DEBUG] No ingredients found via OCR either");
    }
  } else {
    console.log("[ING-DEBUG] Found ingredients through normal parsing");
  }

  console.log("[ING-DEBUG]", {
    hasIngredients: !!ingredients,
    first100: ingredients?.slice(0, 100),
  });

  if (ingredients) {
    numericDoses = /\d+(\.\d+)?\s?(g|mg|mcg|µg|iu|%)\b/i.test(ingredients);

    const ingredientsMatch = ingredients.match(
      /ingredients:\s*([\s\S]*?)(?=\s*WARNING:|\s*ALLERGEN INFORMATION:|$)/i,
    );
    const ingredientsList = ingredientsMatch
      ? ingredientsMatch[1].split(/,|\n/).map((s) => s.trim()).filter((s) =>
        s && s.length > 2 && !/warning|consult|medical|years of age/i.test(s) &&
        s.length < 120
      )
      : [];
    console.log("[STRUCTURE] Cleaned ingredients list:", ingredientsList);
    extra.ingredients = ingredientsList;

    const allergensMatch = ingredients.match(
      /allergen information:\s*([\s\S]*?)(?=\s*WARNING:|$)/i,
    );
    const allergensList = allergensMatch
      ? allergensMatch[1].split(/,|\n|;/).map((s) => s.trim()).filter(Boolean)
      : [];
    console.log("[STRUCTURE] Extracted allergens:", allergensList);
    extra.allergens = allergensList;

    const warningsMatch = ingredients.match(/warning:\s*([\s\S]*)/i);
    const warningsList = warningsMatch
      ? warningsMatch[1].split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    console.log("[STRUCTURE] Extracted warnings:", warningsList);
    extra.warnings = warningsList;

    const manufacturerMatch = ingredients.match(
      /manufactured for and distributed by\s*([\s\S]*)/i,
    );
    const manufacturerText = manufacturerMatch
      ? manufacturerMatch[1].trim()
      : "";
    console.log("[STRUCTURE] Manufacturer found:", manufacturerText);
    extra.manufacturer = manufacturerText;
  }

  if (!ingredients) {
    console.log("[ING‑DEBUG] No high-confidence ingredient candidates found");
  }
  return {
    title,
    ingredients_raw: ingredients,
    numeric_doses_present: numericDoses,
    ...extra,
    ingredients: (extra.ingredients as string[]) || [],
    allergens: (extra.allergens as string[]) || [],
    warnings: (extra.warnings as string[]) || [],
    manufacturer: extra.manufacturer as string || "",
  };
}

// Main request handler
const handler = async (req: Request) => {
  const startTime = Date.now();
  let url: string;
  let forceScrapfly = false;
  let proxyMode = "auto";
  let body: any;

  const meta: ExtractionResponse["_meta"] & {
    firecrawlExtractMs?: number;
    firecrawlCrawlMs?: number;
    scrapflyMs?: number;
    scraperApiMs?: number;
    firecrawlExtractHttpStatus?: number;
    firecrawlCrawlHttpStatus?: number;
    scrapflyHttpStatus?: number;
    scraperApiHttpStatus?: number;
    scraperApiStatus?: number;
    scraperApiBodySnippet?: string;
    proxyMode?: string;
  } = {
    source: "none",
    firecrawlExtractStatus: "not_attempted",
    firecrawlCrawlStatus: "not_attempted",
    scrapflyStatus: "not_attempted",
    timing: {
      totalMs: 0,
      firecrawlExtractMs: 0,
      firecrawlCrawlMs: 0,
      scrapflyMs: 0,
      scraperApiMs: 0,
    },
    proxyMode: "auto",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bypass authentication for now
  // const authHeader = req.headers.get('Authorization');
  // if (!authHeader) {
  //   return errorResponse('Missing authorization header', 200, meta);
  // }

  // Variables already declared above

  try {
    if (req.method !== "POST") {
      return errorResponse("Method Not Allowed", 405, meta);
    }
    try {
      body = await req.json();
    } catch (err: unknown) {
      console.error(
        "Failed to parse JSON body:",
        err instanceof Error ? err.message : String(err),
      );
      return errorResponse("Invalid JSON in request body", 400, meta);
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
    if (
      urlParams.get("forceScrapfly") === "true" ||
      urlParams.get("scrapfly") === "true"
    ) {
      forceScrapfly = true;
    }

    console.log("Parsed url:", url);
    if (!url) {
      return errorResponse("URL is required", 400, meta);
    }

    // IMPROVED: Get API Keys from validated environment config
    const firecrawlKey = ENV_CONFIG.FIRECRAWL_API_KEY;
    const scrapflyKey = ENV_CONFIG.SCRAPFLY_API_KEY;

    if (!firecrawlKey && !forceScrapfly) { // Firecrawl is primary, warn if no key and not forcing Scrapfly
      console.warn(
        "FIRECRAWL_API_KEY is not set. Will try Scrapfly if possible.",
      );
    }

    console.log(
      `[${new Date().toISOString()}] Starting extraction for: ${url}`,
    );
    if (forceScrapfly) {
      console.log(
        `[${new Date().toISOString()}] Force Scrapfly mode activated.`,
      );
    }

    let extractedData: any | null = null; // For Firecrawl /extract structured data
    let extractedHtml: string | null = null; // For raw HTML/Markdown from crawl or Scrapfly

    // 1. Try Firecrawl /v1/extract first (unless forceScrapfly is true or Firecrawl key is missing)
    if (!forceScrapfly && firecrawlKey) {
      const { data, status, httpStatus } = await tryFirecrawlExtract(
        url,
        firecrawlKey,
        proxyMode,
      );
      meta.firecrawlExtractStatus = status;
      meta.firecrawlExtractHttpStatus = httpStatus;
      meta.timing.firecrawlExtractMs = Date.now() - startTime; // Initial timing for this step
      meta.firecrawlExtractMs = meta.timing.firecrawlExtractMs;
      meta.proxyMode = proxyMode; // Log which proxy mode was used

      if (status === "success" && data) {
        extractedData = data;
        meta.source = "firecrawl-extract";
      }
    } else if (forceScrapfly) {
      meta.firecrawlExtractStatus = "not_attempted";
      meta.firecrawlCrawlStatus = "not_attempted"; // Ensure crawl also marked not attempted if forced
    }

    // 2. If no structured data from extract, try Firecrawl /v1/crawl (unless forceScrapfly is true or Firecrawl key is missing)
    if (!extractedData && !forceScrapfly && firecrawlKey) {
      const { html, status, httpStatus } = await tryFirecrawlCrawl(
        url,
        firecrawlKey,
        proxyMode,
      );
      meta.firecrawlCrawlStatus = status;
      meta.firecrawlCrawlMs = (Date.now() - startTime) -
        (meta.firecrawlExtractMs || 0);
      meta.timing.firecrawlCrawlMs = meta.firecrawlCrawlMs;
      meta.firecrawlCrawlHttpStatus = httpStatus;
      meta.proxyMode = proxyMode; // Log which proxy mode was used (also for crawl)

      if (status === "success" && html) {
        extractedHtml = html;
        meta.source = "firecrawl-crawl";
      }
    }

    // 3. If still no content, fallback to Scrapfly
    if (!extractedData && !extractedHtml) {
      const { html, status, httpStatus } = await tryScrapfly(
        url,
        scrapflyKey as string,
      ); // Cast as string since we checked for existence above
      meta.scrapflyStatus = status;
      meta.scrapflyMs = (Date.now() - startTime) -
        ((meta.firecrawlExtractMs || 0) + (meta.firecrawlCrawlMs || 0));
      meta.timing.scrapflyMs = meta.scrapflyMs;
      meta.scrapflyHttpStatus = httpStatus;

      if (status === "success" && html) {
        extractedHtml = html;
        meta.source = "scrapfly";
        console.log("[DEBUG] Scrapfly html length:", html.length);
      }
    }

    // 4. If still no content, fallback to ScraperAPI
    if (!extractedData && !extractedHtml) {
      // IMPROVED: Use validated environment config
      const scraperApiKey = ENV_CONFIG.SCRAPERAPI_KEY;
      if (scraperApiKey) {
        console.log(
          `[${
            new Date().toISOString()
          }] [ScraperAPI] Attempting fallback for ${url}`,
        );
        try {
          const apiUrl =
            `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${
              encodeURIComponent(url)
            }&render=true&ocr=true&premium=true`;
          const scraperStart = Date.now();
          const scraperRes = await fetchWithTimeout(apiUrl, {}, 60000);
          const scraperBody = await scraperRes.text();

          meta.scraperApiStatus = scraperRes.status;
          meta.scraperApiMs = Date.now() - scraperStart;
          meta.scraperApiHttpStatus = scraperRes.status;
          meta.scraperApiBodySnippet = scraperBody.slice(0, 300);

          // Log on failure
          if (!scraperRes.ok) {
            console.error(
              `[ScraperAPI] ERROR ${scraperRes.status}: ${
                scraperBody
                  .slice(0, 300)
                  .replace(/\n/g, " ")
              }`,
            );
          }

          if (scraperRes.ok && scraperBody && scraperBody.length > 1000) {
            extractedHtml = scraperBody;
            meta.source = "scraperapi";
            console.log("[DEBUG] ScraperAPI html length:", scraperBody.length);
          }
        } catch (err: unknown) {
          console.error(
            "[ScraperAPI] Error:",
            err instanceof Error ? err.message : String(err),
          );
        }
      } else {
        console.warn("[ScraperAPI] SCRAPERAPI_KEY not set in environment.");
      }
    }
    // --- Scrapfly+OCR fallback: if Firecrawl fails, parse Scrapfly HTML ---
    let parsed: ParsedProduct | null = null;
    if (!extractedData && extractedHtml) {
      parsed = await parseProductPage(extractedHtml, url);
      if (parsed && parsed.title) {
        meta.source = meta.source === 'scrapfly' ? 'scrapfly' : meta.source;
      }
    }
    // --- Final Response ---
    meta.timing.totalMs = Date.now() - startTime;

    // Always log final meta for debugging
    console.log(
      "[DEBUG] Final meta before response:",
      JSON.stringify(meta, null, 2),
    );

    if (extractedData) {
      // Structured Firecrawl data
      console.log(
        `[${
          new Date().toISOString()
        }] Structured data extracted via ${meta.source}`,
      );
      return createResponse({ data: extractedData, _meta: meta });
    } else if (parsed && parsed.title) {
      // Parsed Scrapfly fallback
      console.log(
        `[${
          new Date().toISOString()
        }] Scrapfly+OCR fallback extracted via ${meta.source}`,
      );
      return createResponse({ parsed, _meta: meta });
    } else if (extractedHtml) {
      // Parse basic fields from HTML (legacy)
      const legacyParsed = await parseProductPage(extractedHtml, url);
      return createResponse({ html: extractedHtml, parsed: legacyParsed, _meta: meta });
    } else {
      // All methods failed
      console.error(
        `❌ [${
          new Date().toISOString()
        }] All extraction methods FAILED for ${url}`,
      );
      return createResponse(
        {
          error:
            "No content extracted from target URL after trying all methods",
          _meta: meta,
        },
        502,
      );
    }
  } catch (error: unknown) {
    // Global error handler for any unexpected issues
    const errorMessage = error instanceof Error ? error.message : String(error);
    meta.timing.totalMs = Date.now() - startTime;
    console.error(
      `🔥 [${new Date().toISOString()}] Unhandled error:`,
      errorMessage,
    );

    return errorResponse(
      `An unexpected error occurred: ${errorMessage}`,
      500,
      meta,
    );
  }
};
serve(handler);
