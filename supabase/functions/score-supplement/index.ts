/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupplementData, SimplifiedAIResponse, FullSupplementScoreResponse } from "../../_shared/types.ts";
import { validateEnvironmentOrThrow } from "../_shared/env-validation.ts";

// ADDED: Validate environment at startup - fail fast if misconfigured
const ENV_CONFIG = validateEnvironmentOrThrow();

function expandToFull(
  r: SimplifiedAIResponse,
  productName: string,
): FullSupplementScoreResponse {
  const map = {
    ingredient_transparency: r.t,
    label_accuracy: r.t,
    clinical_doses: r.dose,
    bioavailability: r.dose,
    third_party_testing: r.qual,
    manufacturing_standards: r.qual,
    additives_fillers: r.risk,
    brand_history: r.risk,
    consumer_sentiment: r.risk,
  } as const;

  const weights: Record<keyof typeof map, number> = {
    ingredient_transparency: 0.20,
    clinical_doses: 0.15,
    bioavailability: 0.10,
    third_party_testing: 0.15,
    additives_fillers: 0.10,
    label_accuracy: 0.10,
    manufacturing_standards: 0.10,
    brand_history: 0.05,
    consumer_sentiment: 0.05,
  };

  let final = 0;
  for (const k in map) final += (map as any)[k] * weights[k as keyof typeof map] * 10;

  return {
    product_id: r.pid,
    product_name: productName,
    final_score: Math.round(final),
    score_breakdown: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, { score: v, reasons: [], weight: weights[k as keyof typeof map] * 100 }])
    ) as any,
    overall_assessment: {
      strengths: r.highlights?.slice(0, 1) ?? [],
      weaknesses: [],
      recommendations: r.highlights?.slice(1) ?? [],
      safety_rating: "—",
      efficacy_rating: "—",
      transparency_rating: "—",
    },
    sources: [],
    timestamp: new Date().toISOString(),
    confidence_score: 0.9,
  };
}

async function score(data: any, scraped: any) {
  // IMPROVED: Use validated environment config instead of direct Deno.env.get
  const key = ENV_CONFIG.OPENROUTER_API_KEY;

  // Use the new prompt and userContent if provided
  const systemPrompt = data.systemPrompt ?? `You are SupplementScoreAI. Using the provided data and optional scraped text, score the product. Return ONLY minified JSON with keys pid,t,dose,qual,risk,highlights. The values for 't' (transparency), 'dose' (clinical dosage/bioavailability), 'qual' (quality/testing), and 'risk' (additives/brand history) MUST be **integers representing a score from 1 to 10**. For example, 7. If a specific score cannot be determined, return '0' as the number. The 'highlights' should be an array of strings.`;
  const userContent = data.userContent ?? JSON.stringify(data);

  try {
    // FIXED: Removed duplicate 'messages' array and undefined 'prompt' variable
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userContent }
        ],
        temperature: 0,
        response_format: {
          type: "json_object"
        }
      })
    });

    // --- NEW LOGGING ADDED BELOW THIS LINE ---
    const rawResText = await res.text();
    console.log(`OpenRouter response status: ${res.status}`);
    console.log(`OpenRouter raw response body: ${rawResText}`);
    // --- NEW LOGGING ADDED ABOVE THIS LINE ---

    if (!res.ok) {
      console.error(`OpenRouter error: ${res.status} - ${rawResText}`);
      throw new Error(`OpenRouter error ${res.status}: ${rawResText}`);
    }

    const j = JSON.parse(rawResText);
    const txt = j.choices?.[0]?.message?.content ?? "";

    console.log("OpenRouter AI content (txt):", txt);

    if (!txt) {
        console.error("OpenRouter AI returned empty content.");
        throw new Error("OpenRouter AI returned empty content.");
    }

    return JSON.parse(txt);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in score function:", errorMessage);
    throw error;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const handler = async (req: any) => {
  // Handle CORS pre-flight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await req.json();
    const data = body?.data ?? null;
    const scraped = body?.scraped ?? null;

    if (!data || !data.parsed) {
      return new Response(JSON.stringify({ error: "Invalid payload: data.parsed is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const parsed = data.parsed;

    // Robust product data extraction with HTML fallback
    function safeExtractProduct(raw: any) {
      // 1️⃣ try structured Firecrawl results
      const s = raw?.results?.[0]; // Prioritize results[0] for structured data

      const structured = {
        product_name: s?.product_name ?? s?.title ?? null,
        brand:        s?.brand        ?? s?.manufacturer ?? null,
        ingredients:  s?.ingredients  ?? s?.facts        ?? null,
      };

      // 2️⃣ if structured fields are good enough, return them
      if (structured.product_name && structured.ingredients) {
        return { ...structured, html: null };
      }

      // 3️⃣ fallback: look for raw HTML from the main 'data' object
      const html = raw?.data?.html ?? null; // Correctly gets html from raw.data

      return { ...structured, html };  // may contain html string
    }

    const { ingredients_raw, numeric_doses_present, title } = parsed;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: data.parsed.title is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!ingredients_raw) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: data.parsed.ingredients_raw is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (numeric_doses_present === undefined) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: data.parsed.numeric_doses_present is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const systemPrompt = `
You are a supplement-analysis assistant. Given structured JSON, extract:
• product_name
• brand
• full ingredient list with doses
Then score the product 0-100 and give a short justification.
If numeric_doses_present is false, Transparency ≤ 4 and Clinical Doses ≤ 3 unless reliable external data is provided.
`;

    const userContent = JSON.stringify({
      product_name: title,
      ingredients: ingredients_raw,
      numeric_doses_present,
    });

    const simple = await score({ systemPrompt, userContent }, scraped);
    const full = expandToFull(simple, title);

    // IMPROVED: Use validated environment config for Supabase client
    const supabase = createClient(
      ENV_CONFIG.SUPABASE_URL,
      ENV_CONFIG.SUPABASE_ANON_KEY,
    );
    await supabase.from("scored_products").upsert([full], { onConflict: "product_id" });
    
    // Return AI JSON response with metadata
    return new Response(JSON.stringify({ 
      data: simple, 
      _meta: { model: 'openrouter', ts: Date.now() } 
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);

export { handler };
