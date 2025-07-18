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

/* ---------------------------------------------------------------------------
 * 1. typed meta
 * -------------------------------------------------------------------------*/
type Provider = "firecrawlExtract" | "firecrawlCrawl" | "scrapfly" | "scraperapi" | "none";
interface Meta {
  provider: Provider;
  proxy: string;
  firecrawlExtract?: { ms: number; status: number };
  firecrawlCrawl?: { ms: number; status: number };
  scrapfly?: { ms: number; status: number };
  scraperapiMs?: number;
  scraperapiStatus?: "success" | "empty" | "failed";
  scraperapiHttpStatus?: number;
}

/* ---------------------------------------------------------------------------
 * 2. Firecrawl helpers
 * -------------------------------------------------------------------------*/
async function firecrawlExtract(
  url: string,
  key: string,
  proxy = "auto",
): Promise<{ data: any | null; ms: number; status: number }> {
  const t0 = Date.now();
  const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/extract",
      {
        method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, proxy, timeout: 10_000 }),
    },
    20_000,
  );
  const ms = Date.now() - t0;
  const j = res.ok ? await res.json().catch(() => ({})) : {};
  return { data: j?.data ?? null, ms, status: res.status };
}

async function firecrawlCrawl(
  url: string,
  key: string,
  proxy = "auto",
): Promise<{ html: string | null; ms: number; status: number }> {
  const t0 = Date.now();
  const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/crawl",
      {
        method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
        url,
        proxy,
        extractorOptions: { mode: "html" },
        timeout: 20_000,
        }),
      },
    25_000,
  );
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
    const qs = new URLSearchParams({
    key,
    url,
      render_js: "true",
      asp: "true",
    ocr: "true",
    ...(stealth ? { stealth: "true", proxy: "datacenter" } : {}),
    });
  const t0 = Date.now();
  const res = await fetchWithTimeout(
      `https://api.scrapfly.io/scrape?${qs}`,
      {},
    15_000,
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
): Promise<{ html: string | null; status: "success" | "empty" | "failed"; httpStatus: number; ms: number }> {
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
    20_000,
  );
  const ms = Date.now() - t0;
  
  if (!res.ok) {
    return { html: null, status: "failed", httpStatus: res.status, ms };
  }
  
  const html = await res.text().catch(() => "");
  
  if (html.length > 1000) {
    return { html, status: "success", httpStatus: res.status, ms };
  } else {
    return { html: null, status: "empty", httpStatus: res.status, ms };
  }
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
 * 5. main handler
 * -------------------------------------------------------------------------*/
async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { url, proxy = "auto", forceScrapfly = false } = await req
    .json()
    .catch(() => ({}));
  if (!url) return json({ error: "url is required" }, 400);

  const meta: Meta = { provider: "none", proxy };

  /* Firecrawl /extract */
  if (!forceScrapfly && env.FIRECRAWL_API_KEY) {
    const { data, ms, status } = await firecrawlExtract(url, env.FIRECRAWL_API_KEY, proxy);
    meta.firecrawlExtract = { ms, status };
    if (data?.content) {
      meta.provider = "firecrawlExtract";
      // Return structured data with compatible _meta format
      return json({ 
        data, 
        _meta: { 
          ...meta, 
          source: "firecrawl",  // Map provider to expected source name
          provider: undefined   // Remove provider field to avoid confusion
        } 
      });
    }
  }

  /* Firecrawl /crawl */
  let html: string | null = null;
  if (!forceScrapfly && env.FIRECRAWL_API_KEY) {
    const { html: h, ms, status } = await firecrawlCrawl(url, env.FIRECRAWL_API_KEY, proxy);
    meta.firecrawlCrawl = { ms, status };
    html = h;
    if (html) meta.provider = "firecrawlCrawl";
  }

  /* Scrapfly */
  if (!html && env.SCRAPFLY_API_KEY) {
    const { html: h, ms, status } = await scrapfly(
      url,
      env.SCRAPFLY_API_KEY,
      (globalThis as any).Deno?.env?.get?.("SCRAPFLY_STEALTH") === "true",
    );
    meta.scrapfly = { ms, status };
    html = h;
    if (html) meta.provider = "scrapfly";
  }

  /* ScraperAPI */
  if (!html && env.SCRAPERAPI_KEY) {
    const { html: h, status, httpStatus, ms } = await tryScraperApi(url, env.SCRAPERAPI_KEY);
    meta.scraperapiMs = ms;
    meta.scraperapiStatus = status;
    meta.scraperapiHttpStatus = httpStatus;
    html = h;
    if (html) meta.provider = "scraperapi";
  }

  if (!html) return json({ error: "No provider returned HTML", _meta: { ...meta, source: "none" } }, 502);

  /* OCR + parse */
  const ocr = await lightOCR(html, url, env.OCRSPACE_API_KEY);
  const parsed = await parseProductPage(html, url, ocr);
  
  // Map provider names to expected source names for compatibility
  const sourceMap: Record<string, string> = {
    "firecrawlExtract": "firecrawl",
    "firecrawlCrawl": "firecrawl", 
    "scrapfly": "scrapfly",
    "scraperapi": "scraperapi",
    "none": "none"
  };
  
  // Return flattened response for compatibility with existing callers
  const legacyMarkdown = parsed.supplement_facts ?? parsed.ingredients_raw ?? null;
  return json({ 
    ...parsed,  // Flatten title, ingredients_raw, etc. to top level
    markdown: legacyMarkdown, // legacy field some callers expect
    _meta: { 
      ...meta, 
      source: sourceMap[meta.provider] || meta.provider,  // Compatible source field
      provider: undefined   // Remove provider field to avoid confusion
    } 
  });
}

/* ---------------------------------------------------------------------------
 * 6. Edge entry + export for tests
 * -------------------------------------------------------------------------*/
serve(handler);   // Edge runtime - rock-solid three-tier provider system
export { handler };
