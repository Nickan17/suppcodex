/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { validateEnvironmentOrThrow } from "../_shared/env-validation.ts";

// ADDED: Validate environment at startup - fail fast if misconfigured
const ENV_CONFIG = validateEnvironmentOrThrow();

// Constants
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 5;

// Initialize Supabase client with validated environment
const supabase = createClient(ENV_CONFIG.SUPABASE_URL, ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Rate limiting with memory cleanup
interface RateLimitEntry {
  count: number;
  lastReset: number;
  lastAccess: number;
}

const requestCounts = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const cutoff = now - (5 * 60 * 1000);
  for (const [ip, entry] of requestCounts.entries()) {
    if (entry.lastAccess < cutoff) {
      requestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Helper function: Generate UPC variants for API lookups
export function upcVariants(raw: string): string[] {
  const cleaned = raw.replace(/\D/g, "");
  const ean13 = cleaned.padStart(13, "0");
  const upc12 = ean13.slice(1); // drop leading 0
  return Array.from(new Set([cleaned, upc12, ean13])); // unique list
}



// Main Edge Function handler
serve(async (req: Request) => {
  const requestStartTime = new Date().toISOString();
  const clientIp = req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") || "unknown";
  console.log(`[${requestStartTime}] Request started from IP: ${clientIp}`);

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // CORS for development/testing
  };

  try { // Outer try-catch for the entire request handling (for any uncaught errors)
    // Handle CORS OPTIONS request
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Rate Limiting Logic
    const now = Date.now();
    const ipData = requestCounts.get(clientIp) || { count: 0, lastReset: now, lastAccess: now };

    if (now - ipData.lastReset > RATE_LIMIT_WINDOW_MS) {
      ipData.count = 1;
      ipData.lastReset = now;
      ipData.lastAccess = now;
    } else {
      ipData.count++;
      ipData.lastAccess = now;
    }
    requestCounts.set(clientIp, ipData);

    if (ipData.count > MAX_REQUESTS_PER_MINUTE) {
      console.log(
        `[${
          new Date().toISOString()
        }] Rate limit triggered for IP: ${clientIp}`,
      );
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
        { status: 429, headers },
      );
    }

    // Check request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers,
      });
    }

    // Environment variables are already validated at startup via ENV_CONFIG

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", details: `${error}` }),
        { status: 400, headers },
      );
    }

    const { upc } = requestBody;

    if (!upc || typeof upc !== "string") {
      return new Response(
        JSON.stringify({
          error: "Invalid UPC format. Expected { upc: string }",
        }),
        { status: 400, headers },
      );
    }

    let finalUrl: string | null = null;
    let source: "openfoodfacts" | "openrouter" | "unknown" = "unknown";
    // deno-lint-ignore no-explicit-any
    let openFoodData: any = null; // Store the full OFF response here
    // deno-lint-ignore no-explicit-any
    let offProduct: any = null; // Store the product object itself
    let offStatus: number | null = null; // Store the top-level status

    // Variables for extracted OFF data
    let productName: string | null = null;
    let productBrand: string | null = null;

    // 1. Attempt to fetch product page URL from OpenFoodFacts using UPC variants
    for (const code of upcVariants(upc)) {
      try {
        console.log(
          `[${
            new Date().toISOString()
          }] Attempting OpenFoodFacts lookup for UPC variant: ${code}`,
        );
        const openFoodFactsResponse = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
        );
        if (openFoodFactsResponse.ok) {
          openFoodData = await openFoodFactsResponse.json(); // Assign full response
          offProduct = openFoodData.product; // Extract product object
          offStatus = openFoodData.status; // Extract top-level status

          console.log(
            "📦 OpenFoodFacts raw response:",
            JSON.stringify(openFoodData, null, 2),
          );

          if (offProduct && offStatus === 1 && offProduct.url) { // Check if OFF provides a direct URL
            finalUrl = offProduct.url;
            source = "openfoodfacts";
            console.log(
              `[${
                new Date().toISOString()
              }] OpenFoodFacts found direct URL for variant ${code}: ${finalUrl}`,
            );
            break; // Exit loop if a valid product URL is found
          } else {
            console.log(
              `[${
                new Date().toISOString()
              }] OpenFoodFacts found product for variant ${code} but status is not 1 or no direct URL.`,
            );
          }
        } else {
          console.warn(
            `[${
              new Date().toISOString()
            }] OpenFoodFacts API error for variant ${code}: ${openFoodFactsResponse.status} ${openFoodFactsResponse.statusText}`,
          );
        }
      } catch (error) {
        console.error(
          `[${
            new Date().toISOString()
          }] Error fetching from OpenFoodFacts for variant ${code}:`,
          error,
        );
      }
    }

    // 2. Robustly extract productName and productBrand from offProduct if available
    if (offProduct && offStatus === 1) {
      productName = offProduct?.product_name ||
        offProduct?.product_name_en ||
        offProduct?.product_name_original ||
        offProduct?.generic_name ||
        null;

      productBrand = offProduct?.brands
        ?.split(/[;,]/)?.[0]
        ?.trim() || null;

      console.log("🟢 OFF extracted name:", productName);
      console.log("🟢 OFF extracted brand:", productBrand);
    }

    // 3. AI (OpenRouter) Call if finalUrl not found by OFF
    if (!finalUrl) {
      let promptContext: string = "";

      const isValidName = productName && productName.length > 4 &&
        !productName.toLowerCase().includes("unknown");
      const isValidBrand = productBrand && productBrand.length > 2 &&
        !productBrand.toLowerCase().includes("unknown");

      if (isValidName || isValidBrand) {
        promptContext += `Product Name: ${productName || "N/A"}\n`;
        promptContext += `Brand: ${productBrand || "N/A"}\n`;
        promptContext += `UPC: ${upc}`;
      } else if (offProduct && offStatus === 1) {
        promptContext += `UPC: ${upc}\n\n`;
        promptContext += `OpenFoodFacts raw product JSON:\n<OFF_JSON>\n${
          JSON.stringify(offProduct, null, 2)
        }\n</OFF_JSON>`;
      } else {
        promptContext += `UPC: ${upc}`;
      }

      const aiPromptContent =
        `You are a supplement research assistant. Your task is to find the official product page URL for a supplement.

  ${promptContext}

  Instructions:
  1. Search for the product page on the brand's official website.
  2. If multiple links exist, choose the most relevant one for the product.
  3. If a valid URL appears in the citations or search results, return it.
  4. Only return "<url>NOT_FOUND</url>" if there is absolutely no product page found on the brand's website.
  5. Output only one result in this format:
  <url>https://brand.com/product</url>

  Do not include any other text or explanation.`;

      // Call OpenRouter API
      const openrouterRes = await fetch(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ENV_CONFIG.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "perplexity/sonar",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert web research assistant that returns only the requested URL.",
              },
              { role: "user", content: aiPromptContent },
            ],
            temperature: 0.0,
          }),
        },
      );

      if (!openrouterRes.ok) {
        console.error(
          `OpenRouter API error: ${openrouterRes.status} - ${await openrouterRes
            .text()}`,
        );
        return new Response(
          JSON.stringify({
            error: "Failed to communicate with AI service for URL lookup.",
          }),
          { status: 500, headers },
        );
      }

      const openrouterJson = await openrouterRes.json();
      const responseText = openrouterJson.choices?.[0]?.message?.content
        ?.trim();

      console.log("🤖 OpenRouter raw response (including tags):", responseText);

      const urlMatch = responseText.match(
        /<url>\s*(https?:\/\/[^<\s]+)\s*<\/url>/i,
      );
      if (
        urlMatch && urlMatch[1] && urlMatch[1].startsWith("http") &&
        urlMatch[1] !== "NOT_FOUND"
      ) {
        finalUrl = urlMatch[1];
        source = "openrouter";
      } else {
        console.warn(
          `🤖 OpenRouter returned no valid URL within tags for UPC: ${upc}. Response: ${responseText}`,
        );
      }
    }

    if (!finalUrl || !finalUrl.startsWith("http")) {
      return new Response(
        JSON.stringify({
          error:
            "Could not resolve product URL from any source (client, OFF, or AI).",
        }),
        { status: 404, headers },
      );
    }

    try {
      new URL(finalUrl); // Validate the resolved URL
    } catch {
      return new Response(
        JSON.stringify({
          error: "Resolved product URL is invalid.",
          product_url: finalUrl,
          upc,
          source,
        }),
        { status: 400, headers },
      );
    }

    // Validate URL accessibility with a HEAD request before scraping
    try {
      const headRes = await fetch(finalUrl, { method: "HEAD" });
      if (!headRes.ok || headRes.status === 404 || headRes.status === 410) {
        console.warn(
          `🛑 URL is unreachable or gone (status: ${headRes.status}): ${finalUrl}`,
        );
        return new Response(
          JSON.stringify({
            error:
              `Resolved product URL is not reachable (status: ${headRes.status}).`,
            product_url: finalUrl,
            upc,
            source,
          }),
          { status: 404, headers },
        );
      }
    } catch (err) {
      console.error("🛑 Error validating final URL before scrape:", err);
      return new Response(
        JSON.stringify({
          error: "Could not verify product URL before scrape.",
          product_url: finalUrl,
          upc,
          source,
        }),
        { status: 502, headers },
      );
    }

    const firecrawlRes = await fetch(
      `${new URL(req.url).origin}/functions/v1/firecrawl-extract`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: finalUrl }),
      },
    );

    let extractedContent: string | null = null;
    if (firecrawlRes.ok) {
      const firecrawlData = await firecrawlRes.json();
      extractedContent = firecrawlData?.data?.content || null;
    } else {
      const errorText = await firecrawlRes.text();
      console.error(
        `Internal firecrawl-extract call failed: ${firecrawlRes.status}`,
        errorText,
      );
    }

    console.log(
      `[${
        new Date().toISOString()
      }] Inserting into Supabase raw_products table for UPC: ${upc}`,
    );

    const { data, error: dbError } = await supabase
      .from("raw_products")
      .upsert(
        [{
          upc: upc,
          raw_content: extractedContent,
          scraped_at: new Date().toISOString(),
        }],
        { onConflict: "upc", ignoreDuplicates: false },
      )
      .select();

    if (dbError) {
      console.error("Database Insert/Update Error:", dbError);
      return new Response(
        JSON.stringify({
          status: 500,
          source: "database",
          error: dbError.message,
          details: dbError,
        }),
        {
          status: 500,
          headers,
        },
      );
    }

    console.log("Database insert/update successful:", data);

    // Final successful response
    return new Response(
      JSON.stringify({
        status: 200,
        source: "firecrawl-extract",
        product_url: finalUrl,
        message: "Product scraped and data processed successfully.",
      }),
      {
        status: 200,
        headers,
      },
    );
  } catch (e: unknown) { // Outer catch for any unhandled errors in the main Deno.serve block
    console.error("Unhandled error in main serve function:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}); // Correct closing for Deno.serve
