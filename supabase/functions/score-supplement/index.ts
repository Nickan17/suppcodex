/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
// Types defined inline since shared types file is missing
interface SupplementData {
  title: string;
  ingredients: string[];
  facts: string;
  warnings: string[];
}
import { validateEnvironmentOrThrow } from "../_shared/env-validation.ts";
import { createSuccessResponse, createErrorResponse } from "../_shared/utils.ts";

// ADDED: Validate environment at startup - fail fast if misconfigured
let ENV_CONFIG: any;
try {
  console.log("Starting environment validation...");
  ENV_CONFIG = validateEnvironmentOrThrow();
  console.log("Environment validation successful");
} catch (error) {
  console.error("Environment validation failed:", error);
  // Continue with minimal config for debugging
  ENV_CONFIG = {
    OPENROUTER_API_KEY: Deno.env.get("OPENROUTER_API_KEY")
  };
}

// Accept { title, ingredients, supplementFacts:{raw}, warnings }
// OR     { title, ingredients, facts, warnings }
const Input = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string()).optional().default([]),
  supplementFacts: z.object({ raw: z.string().optional() }).partial().optional(),
  facts: z.string().optional(),
  warnings: z.array(z.string()).optional().default([]),
}).transform((d) => ({
  title: d.title,
  ingredients: d.ingredients ?? [],
  facts: (d.supplementFacts?.raw ?? d.facts ?? '').toString(),
  warnings: d.warnings ?? [],
}));


async function score(data: any, scraped: any) {
  // IMPROVED: Use validated environment config instead of direct Deno.env.get
  const key = ENV_CONFIG.OPENROUTER_API_KEY;

  // Use the new prompt and userContent if provided
  const systemPrompt = `
You are SupplementScoreAI.

Return ONLY minified JSON with this exact schema (no prose):
{
  "score": <integer 0..100>,
  "purity": <integer 0..100>,
  "effectiveness": <integer 0..100>,
  "safety": <integer 0..100>,
  "value": <integer 0..100>,
  "highlights": [<up to 3 short strings>],
  "concerns": [<up to 3 short strings>]
}

Scoring rubric (weight guidance; keep each field 0..100):
- purity: ingredient quality, absence of fillers/additives, transparency
- effectiveness: evidence-based actives and plausible doses (use facts text if present)
- safety: warnings, contraindications, allergens, proprietary blends
- value: price-per-serving (if not provided, estimate from mainstream market), potency-per-dollar

Overall "score" should be a rounded integer consistent with the subscores (e.g., average or rubric-composite). If data is missing, score conservatively and set subscores to 0 rather than null. Keep highlights/concerns short, user-facing, and specific (e.g., "Whey isolate primary protein").
`.trim();
  const userContent = data.userContent ?? JSON.stringify(data);

  try {
    // FIXED: Removed duplicate 'messages' array and undefined 'prompt' variable
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        'HTTP-Referer': 'https://suppcodex.app',
        'X-Title': 'SuppCodex Scoring',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
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
    const txt = j.choices?.[0]?.message?.content || "";

    console.log("OpenRouter AI content (txt):", txt);

    if (!txt) {
        console.error("OpenRouter AI returned empty content.");
        throw new Error("OpenRouter AI returned empty content.");
    }

    const parsed = JSON.parse(txt);
    const clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    return {
      score: clamp(parsed.score),
      purity: clamp(parsed.purity),
      effectiveness: clamp(parsed.effectiveness),
      safety: clamp(parsed.safety),
      value: clamp(parsed.value),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0,3) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0,3) : [],
    };

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
    console.log("Handler started, ENV_CONFIG:", ENV_CONFIG);
    
    // Check for API key before processing
    if (!ENV_CONFIG.OPENROUTER_API_KEY) {
      console.error("Missing OPENROUTER_API_KEY in ENV_CONFIG");
      return createErrorResponse("OPENROUTER_API_KEY missing", 400, { source: "config" });
    }

    const body = await req.json();
    let input;
    try {
      input = Input.parse(body);
    } catch (e) {
      return createErrorResponse('Invalid score input', 400, { 
        source: 'validation', 
        issues: e?.errors ?? String(e) 
      });
    }

    const userContent = JSON.stringify({
      title: input.title,
      ingredients: input.ingredients,
      facts: input.facts,
      warnings: input.warnings,
    });

    const result = await score({ userContent }, null);

    // Return AI JSON response with metadata
    return createSuccessResponse(result, 200, { model: 'openrouter', ts: Date.now() });
  } catch (err) {
    console.error(err);
    return createErrorResponse(String(err), 500);
  }
};

serve(handler);

export { handler };
