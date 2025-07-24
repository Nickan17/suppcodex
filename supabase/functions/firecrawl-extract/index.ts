1// supabase/functions/firecrawl-extract/index.ts
// © 2025 Supplement‑Codex — clean, test‑friendly extraction handler
// ---------------------------------------------------------------------------
// 0. shared setup
// ---------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { validateEnvironmentOrThrow } from "../_shared/env-validation.ts";
import { parseProductPage } from "./parser.ts";

/*── Env once per cold‑start ───────────────────────────────────────────────*/
const env = validateEnvironmentOrThrow(); // throws fast if keys missing

/*── CORS + helpers ────────────────────────────────────────────────────────*/
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const fetchWithTimeout = (
  url: string,
  init: RequestInit = {},
  ms = 25_000,
): Promise<Response> => {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() =>
    clearTimeout(id)
  );
};

/*── Block detection helper ────────────────────────────────────────────────*/
const bad = [/freshchat/i, /cloudflare.*attention/i, /A problem has occurred/i, /<title>\s*Error/i];
export function looksBlocked(h: string): boolean {
  return bad.some(rx => rx.test(h));
}

/*── Domain blocklist ──────────────────────────────────────────────────────*/
const SITE_BLOCKLIST: Record<string, { reason: string }> = {
  "optimumnutrition.com": { reason: "blocked_by_site" },
};

function getBlockedReason(u: string): string | null {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return SITE_BLOCKLIST[host]?.reason ?? null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * 1. typed meta
 * -------------------------------------------------------------------------*/
type Provider = "firecrawlExtract" | "firecrawlCrawl" | "scrapfly" | "scraperapi" | "none";
interface Meta {
  provider: Provider;
  proxy: string;
  tried: string[];
  success: string | null;
  firecrawlStatus?: number;
  scrapflyStatus?: number;
  scraperapiStatus?: number;
  firecrawlExtract?: { ms: number; status: number };
  firecrawlCrawl?: { ms: number; status: number };
  scrapfly?: { ms: number; status: number };
  scraperapi?: { ms: number; status: number };
}

/* ---------------------------------------------------------------------------
 * 2. Firecrawl helpers
 * -------------------------------------------------------------------------*/
async function firecrawlExtract(
  url: string,
  key: string,
): Promise<{ data: any | null; html: string | null; ms: number; status: number }> {
  const t0 = Date.now();
  let res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/extract",
      {
        method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url], timeout: 10_000 }),
    },
    20_000,
  );
  
  // If 429 or 400, retry once with stealth proxy
  if ((res.status === 429 || res.status === 400)) {
    res = await fetchWithTimeout(
        "https://api.firecrawl.dev/v1/extract",
        {
          method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url], proxy: "stealth", timeout: 10_000 }),
      },
      20_000,
    );
  }
  
  const ms = Date.now() - t0;
  const j = res.ok ? await res.json().catch(() => ({})) : {};
  
  // Check if we have structured data but missing nutrition/supplement facts
  const hasNutritionData = j?.data?.content && /nutrition facts|supplement facts/i.test(j.data.content);
  const htmlContent = j?.data?.html || null;
  
  // If structured content lacks nutrition but HTML has it, return HTML for parsing
  if (j?.data?.content && !hasNutritionData && htmlContent && /nutrition facts|supplement facts/i.test(htmlContent)) {
    return { data: null, html: htmlContent, ms, status: res.status };
  }
  
  return { data: j?.data ?? null, html: htmlContent, ms, status: res.status };
}

async function firecrawlCrawl(
  url: string,
  key: string,
): Promise<{ html: string | null; ms: number; status: number }> {
  const t0 = Date.now();
  let res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/crawl",
      {
        method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
        urls: [url],
        extractorOptions: { mode: "html" },
        timeout: 20_000,
        }),
      },
    25_000,
  );
  
  // If 429 or 400, retry once with stealth proxy
  if ((res.status === 429 || res.status === 400)) {
    res = await fetchWithTimeout(
        "https://api.firecrawl.dev/v1/crawl",
        {
          method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
          urls: [url],
          proxy: "stealth",
          extractorOptions: { mode: "html" },
          timeout: 20_000,
          }),
        },
      25_000,
    );
  }
  
  const ms = Date.now() - t0;
  const j = res.ok ? await res.json().catch(() => ({})) : {};
  return { html: j?.data?.content ?? null, ms, status: res.status };
}

/* ---------------------------------------------------------------------------
 * 3. Scrapfly helper (stealth via env.SCRAPFLY_STEALTH=true)
 * -------------------------------------------------------------------------*/
async function scrapfly(
  url: string,
  key: string,
  stealth = false,
): Promise<{ html: string | null; ms: number; status: number }> {
  const isCellucor = /cellucor\.com/.test(url);
  const baseParams: Record<string, string> = {
    key,
    url,
    render_js: "true",
    asp: "true",
    country: "us",
    ...(stealth ? { stealth: "true", proxy: "datacenter" } : {}),
  };
  
  // Add domain-specific params only for cellucor.com
  if (isCellucor) {
    baseParams.wait_for = "2000";
    baseParams.scrape_css_only = "false";
  }
  
  const qs = new URLSearchParams(baseParams);
  const t0 = Date.now();
  const res = await fetchWithTimeout(
    `https://api.scrapfly.io/scrape?${qs}`,
    {},
    30_000,
  );
  const ms = Date.now() - t0;
  const j = res.ok ? await res.json().catch(() => ({})) : {};
  return { html: j?.result?.content ?? null, ms, status: res.status };
}

/* ---------------------------------------------------------------------------
 * 4. ScraperAPI helper (premium scraping with US proxy)
 * -------------------------------------------------------------------------*/
async function tryScraperApi(
  url: string,
  key: string,
): Promise<{ html: string | null; ms: number; status: number }> {
  const params = new URLSearchParams({
    api_key: key,
    url,
    render: "true",
    premium: "true",
    country_code: "us"
  });
  
  const t0 = Date.now();
  const res = await fetchWithTimeout(
    `https://api.scraperapi.com?${params}`,
    {},
    30_000,
  );
  const ms = Date.now() - t0;
  
  if (!res.ok) {
    return { html: null, ms, status: res.status };
  }
  
  const html = await res.text().catch(() => "");
  return { html: html.length > 1000 ? html : null, ms, status: res.status };
}

/* ---------------------------------------------------------------------------
 * 5. ultra‑light OCR panel grab
 * -------------------------------------------------------------------------*/
async function lightOCR(
  html: string,
  pageUrl: string,
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey) return null;

    const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  const imgs = [...doc.querySelectorAll("img")] as Element[];
  if (!imgs.length) return null;

  // Rank images by likelihood of containing supplement panel
  const ranked = imgs
    .map((el, index) => {
      const src = (el.getAttribute("src") || "").toLowerCase();
      const alt = (el.getAttribute("alt") || "").toLowerCase();
      let score = 0;
      if (/supplement|nutrition|facts|ingredients|panel|label|back/.test(src)) score += 3;
      if (/supplement|nutrition|facts|ingredients|panel|label|back/.test(alt)) score += 3;

      // Boost mid‑carousel positions (5‑20) and filenames hinting at panels
      if (index >= 4 && index < 20) score += 1;          // positional boost
      if (/facts|panel|ingredients/.test(src)) score += 2; // filename boost

      return { el, score, index };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // max 8 images to OCR

  for (const { el } of ranked) {
    let src = el.getAttribute("src") || "";
    if (!src) continue;
    if (src.startsWith("//")) src = `https:${src}`;
    if (src.startsWith("/")) src = new URL(src, pageUrl).href;

    try {
      const fd = new FormData();
      fd.append("url", src);
      fd.append("apikey", apiKey);
      fd.append("language", "eng");
      fd.append("isOverlayRequired", "false");
      fd.append("scale", "true");
      const res = await fetchWithTimeout(
        "https://api.ocr.space/parse/image",
        { method: "POST", body: fd },
        10_000,
      );
      const j = await res.json().catch(() => ({}));
      const text = j?.ParsedResults?.[0]?.ParsedText as string | undefined;
      if (!text) continue;
      const clean = text.trim();
      if (/ingredients?:/i.test(clean) || /supplement\s*facts/i.test(clean)) {
        return clean;
      }
    } catch (_) {
      // ignore OCR errors and continue
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * 4. remediation metadata
 * -------------------------------------------------------------------------*/
type MiniMeta = {
  firecrawlStatus?: number;
  scrapflyStatus?: number;
  scraperapiStatus?: number;
  htmlReturned?: boolean;
};

function computeRemediation(meta: MiniMeta & { blockedReason?: string | null; parsed?: any }) {
  // Blocked site short-circuit handled above, but keep as fallback
  if (meta.blockedReason) {
    return {
      status: "blocked_by_site",
      remediation: "manual_qa",
      remediation_notes: "Manual-only or partner API until further notice."
    };
  }

  if (!meta.htmlReturned) {
    const codes = [meta.firecrawlStatus, meta.scrapflyStatus, meta.scraperapiStatus].filter(
      (c): c is number => typeof c === "number"
    );
    if (codes.some(c => c === 404)) return { status: "dead_url", remediation: "fix_url" };
    if (codes.some(c => c === 403)) return { status: "provider_error", remediation: "rotate_key", remediation_notes: "403 auth/plan issue." };
    if (codes.some(c => c === 429)) return { status: "provider_error", remediation: "upgrade_plan", remediation_notes: "Quota exhausted." };
    return { status: "provider_error", remediation: "switch_provider" };
  }

  // Check if extraction was successful (all 3 key fields present)
  const parsed = meta.parsed;
  if (parsed?.title && 
      parsed?.ingredients_raw && parsed.ingredients_raw.length >= 100 &&
      parsed?.supplement_facts && parsed.supplement_facts.length >= 200) {
    return { status: "success", remediation: "none" };
  }

  // HTML returned but we didn't meet success thresholds -> parser issue
  return { status: "parser_fail", remediation: "site_specific_parser" };
}

/* ---------------------------------------------------------------------------
 * 5. main handler
 * -------------------------------------------------------------------------*/
async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { url, proxy = "auto", forceScrapfly = false } = await req
    .json()
    .catch(() => ({}));
  if (!url) return json({ error: "url is required" }, 400);

  const blockedReason = getBlockedReason(url);
  if (blockedReason) {
    return json({
      error: "Domain blocked by site policy",
      _meta: {
        status: "blocked_by_site",
        blockedReason,
        remediation: "manual_qa",
        remediation_notes: "Optimum Nutrition treats all bots as hostile; handle SKUs manually or via partner API.",
        domain: new URL(url).hostname
      }
    }, 451);
  }

  const meta: Meta = { 
    provider: "none", 
    proxy, 
    tried: [], 
    success: null,
    firecrawlStatus: undefined,
    scrapflyStatus: undefined,
    scraperapiStatus: undefined
  };

  /* Firecrawl /extract */
  let html: string | null = null;
  if (!forceScrapfly && env.FIRECRAWL_API_KEY) {
    meta.tried.push("firecrawl");
    const { data, html: extractHtml, ms, status } = await firecrawlExtract(url, env.FIRECRAWL_API_KEY);
    meta.firecrawlExtract = { ms, status };
    meta.firecrawlStatus = status;
    
    if (data?.content) {
      meta.provider = "firecrawlExtract";
      meta.success = "firecrawl";
      return json({ 
        data, 
        _meta: { 
          ...meta, 
          source: "firecrawl",
          provider: undefined
        } 
      });
    }
    
    // Check if HTML looks blocked
    if (extractHtml && looksBlocked(extractHtml)) {
      if (env.SCRAPERAPI_KEY) {
        const { html: h, ms: sMs, status: sStatus } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
        meta.scraperapi = { ms: sMs, status: sStatus };
        meta.scraperapiStatus = sStatus;
        if (h) {
          html = h;
          meta.provider = "scraperapi";
          meta.success = "scraperapi";
        }
      }
    } else if (extractHtml) {
      html = extractHtml;
      meta.provider = "firecrawlExtract";
      meta.success = "firecrawl";
    }
  }

  /* Firecrawl /crawl */
  if (!html && !forceScrapfly && env.FIRECRAWL_API_KEY) {
    const { html: h, ms, status } = await firecrawlCrawl(url, env.FIRECRAWL_API_KEY);
    meta.firecrawlCrawl = { ms, status };
    if (!meta.firecrawlStatus) meta.firecrawlStatus = status;
    
    // Check if HTML looks blocked
    if (h && looksBlocked(h)) {
      if (env.SCRAPERAPI_KEY) {
        const { html: sHtml, ms: sMs, status: sStatus } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
        meta.scraperapi = { ms: sMs, status: sStatus };
        meta.scraperapiStatus = sStatus;
        if (sHtml) {
          html = sHtml;
          meta.provider = "scraperapi";
          meta.success = "scraperapi";
        }
      }
    } else if (h) {
      html = h;
      meta.provider = "firecrawlCrawl";
      meta.success = "firecrawl";
    }
  }

  /* Scrapfly */
  if (!html && env.SCRAPFLY_API_KEY) {
    meta.tried.push("scrapfly");
    const { html: h, ms, status } = await scrapfly(
      url,
      env.SCRAPFLY_API_KEY,
      (globalThis as any).Deno?.env?.get?.("SCRAPFLY_STEALTH") === "true",
    );
    meta.scrapfly = { ms, status };
    meta.scrapflyStatus = status;
    
    // Check if HTML looks blocked
    if (h && looksBlocked(h)) {
      if (env.SCRAPERAPI_KEY) {
        const { html: sHtml, ms: sMs, status: sStatus } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
        meta.scraperapi = { ms: sMs, status: sStatus };
        meta.scraperapiStatus = sStatus;
        if (sHtml) {
          html = sHtml;
          meta.provider = "scraperapi";
          meta.success = "scraperapi";
        }
      }
    } else if (h) {
      html = h;
      meta.provider = "scrapfly";
      meta.success = "scrapfly";
    }
  }

  /* ScraperAPI domain-specific escalation */
  if (
    !html &&
    /(?:optimumnutrition|cellucor)\.com/.test(url) &&
    env.SCRAPERAPI_KEY
  ) {
    const { html: h, ms, status } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
    meta.scraperapi = { ms, status };
    meta.scraperapiStatus = status;
    if (h) {
      html = h;
      meta.provider = "scraperapi";
      meta.success = "scraperapi";
    }
  }

  /* ScraperAPI */
  if (!html && env.SCRAPERAPI_KEY) {
    meta.tried.push("scraperapi");
    const { html: h, ms, status } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
    meta.scraperapi = { ms, status };
    meta.scraperapiStatus = status;
    
    if (h) {
      html = h;
      meta.provider = "scraperapi";
      meta.success = "scraperapi";
    }
  }

  if (!html) return json({ error: "No provider returned HTML", _meta: { ...meta, source: "none" } }, 502);

  /* OCR + parse */
  const ocr = await lightOCR(html, url, env.OCRSPACE_API_KEY);
  const parsed = await parseProductPage(html, url, ocr, env);
  
  // Map provider names to expected source names for compatibility
  const sourceMap: Record<string, string> = {
    "firecrawlExtract": "firecrawl",
    "firecrawlCrawl": "firecrawl", 
    "scrapfly": "scrapfly",
    "scraperapi": "scraperapi",
    "none": "none"
  };
  
  // Compute remediation metadata
  const remediation = computeRemediation({
    firecrawlStatus: meta.firecrawlStatus,
    scrapflyStatus: meta.scrapflyStatus,
    scraperapiStatus: meta.scraperapiStatus,
    blockedReason: undefined, // already handled above
    htmlReturned: !!html,
    parsed: parsed
  });

  // Return flattened response for compatibility with existing callers
  const legacyMarkdown = parsed.supplement_facts ?? parsed.ingredients_raw ?? null;
  return json({ 
    ...parsed,  // Flatten title, ingredients_raw, etc. to top level
    markdown: legacyMarkdown, // legacy field some callers expect
    _meta: { 
      ...meta, 
      source: sourceMap[meta.provider] || meta.provider,  // Compatible source field
      provider: undefined,   // Remove provider field to avoid confusion
      parserSteps: parsed._meta?.parserSteps || [],  // Include parser telemetry
      ...remediation  // Add status and remediation metadata
    } 
  });
}

/* ---------------------------------------------------------------------------
 * 6. Edge entry + export for tests
 * -------------------------------------------------------------------------*/
serve(handler);   // Edge runtime - rock-solid three-tier provider system
export { handler };
