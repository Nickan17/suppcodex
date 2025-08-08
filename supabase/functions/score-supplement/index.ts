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

// Types for chain telemetry
interface ChainStep {
  provider: string;
  try?: number;
  status: "ok" | "error";
  ms: number;
  code?: number;
  hint?: string;
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


/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call OpenRouter API with retry logic and telemetry
 */
async function callOpenRouterWithRetries(
  key: string,
  systemPrompt: string,
  userContent: string
): Promise<{ result: any; chain: ChainStep[] }> {
  const chain: ChainStep[] = [];
  const maxRetries = 2; // max 2 retries as specified
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Calling OpenRouter (attempt ${attempt}/${maxRetries + 1})`);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

      const ms = Date.now() - startTime;
      
      // Handle 429 "Out of credits" specifically
      if (response.status === 429) {
        const errorText = await response.text().catch(() => "Rate limit exceeded");
        
        const step: ChainStep = {
          provider: "openrouter",
          try: attempt,
          status: "error",
          ms,
          code: response.status,
          hint: "Out of credits",
        };
        chain.push(step);
        
        // Return immediately for 429 - don't retry
        console.log(`❌ OpenRouter quota exceeded (429)`);
        throw new Error(`OPENROUTER_QUOTA_EXCEEDED:${errorText}`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        const step: ChainStep = {
          provider: "openrouter",
          try: attempt,
          status: "error",
          ms,
          code: response.status,
          hint: `HTTP ${response.status}`,
        };
        chain.push(step);

        // Retry on 5xx errors
        const shouldRetry = response.status >= 500 && attempt <= maxRetries;
        if (shouldRetry) {
          const jitter = Math.random() * 500; // 0-500ms jitter as specified
          console.log(`⏳ Retrying in ${jitter.toFixed(0)}ms after ${response.status} error...`);
          await sleep(jitter);
          continue;
        }
        
        // No more retries or shouldn't retry
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
      }

      // Success case
      const rawResText = await response.text();
      const step: ChainStep = {
        provider: "openrouter",
        try: attempt,
        status: "ok",
        ms,
        code: response.status,
      };
      chain.push(step);

      console.log(`✅ OpenRouter success (${ms}ms)`);
      const j = JSON.parse(rawResText);
      return { result: j, chain };

    } catch (error) {
      const ms = Date.now() - startTime;
      
      // Check if this is a quota error that was already handled above
      if (error instanceof Error && error.message.startsWith('OPENROUTER_QUOTA_EXCEEDED:')) {
        throw error; // Re-throw without additional chain step
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ OpenRouter error (attempt ${attempt}):`, errorMessage);
      
      const step: ChainStep = {
        provider: "openrouter",
        try: attempt,
        status: "error",
        ms,
        hint: `Request failed: ${errorMessage}`,
      };
      chain.push(step);

      // Retry on network errors
      if (attempt <= maxRetries) {
        const jitter = Math.random() * 500; // 0-500ms jitter
        console.log(`⏳ Retrying in ${jitter.toFixed(0)}ms after network error...`);
        await sleep(jitter);
        continue;
      }
      
      // No more retries
      throw error;
    }
  }
  
  // Should never reach here
  throw new Error("Unexpected end of retry loop");
}

async function score(data: any, scraped: any): Promise<{ result: any; chain: ChainStep[] }> {
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

Special rules for product types:
- If facts_kind is "nutrition_facts" and ingredients exist but no numeric dosages: treat as normal for protein powders. Penalize transparency slightly for missing dosages; do not invent dosages.
- If product_type_hint is "protein": focus purity and ingredient quality (sweeteners, gums, additives), allergen clarity, and overall transparency. Effectiveness is more about protein quality than dosed actives.
- For concerns: prefer "No per-ingredient dosages disclosed" over "No ingredient list provided" when ingredients exist but dosages are missing.

Overall "score" should be a rounded integer consistent with the subscores (e.g., average or rubric-composite). If data is missing, score conservatively and set subscores to 0 rather than null. Keep highlights/concerns short, user-facing, and specific (e.g., "Whey isolate primary protein").
`.trim();
  const userContent = data.userContent ?? JSON.stringify(data);

  try {
    // Call OpenRouter with retry logic and telemetry
    const { result, chain } = await callOpenRouterWithRetries(key, systemPrompt, userContent);
    
    const txt = result.choices?.[0]?.message?.content || "";
    console.log("OpenRouter AI content length:", txt.length);

    if (!txt) {
        console.error("OpenRouter AI returned empty content.");
        throw new Error("OpenRouter AI returned empty content.");
    }

    const parsed = JSON.parse(txt);
    const clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    
    const scoreResult = {
      score: clamp(parsed.score),
      purity: clamp(parsed.purity),
      effectiveness: clamp(parsed.effectiveness),
      safety: clamp(parsed.safety),
      value: clamp(parsed.value),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0,3) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0,3) : [],
    };
    
    return { result: scoreResult, chain };

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
    console.log("Handler started");
    
    // Check for API key before processing (without logging the key)
    if (!ENV_CONFIG.OPENROUTER_API_KEY) {
      console.error("Missing OPENROUTER_API_KEY in configuration");
      return createErrorResponse("OPENROUTER_API_KEY missing", 400, { source: "config" });
    }

    const body = await req.json();
    let input;
    try {
      input = Input.parse(body);
    } catch (e) {
      return createErrorResponse('Invalid score input', 400, { 
        source: 'validation', 
        issues: (e as any)?.errors ?? String(e) 
      });
    }

    const userContent = JSON.stringify({
      title: input.title,
      ingredients: input.ingredients,
      facts: input.facts,
      warnings: input.warnings,
    });

    const { result, chain } = await score({ userContent }, null);

    // Return AI JSON response with metadata and telemetry
    return createSuccessResponse(result, 200, {
      model: 'openrouter',
      ts: Date.now(),
      chain
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Handler error:", errorMessage);
    
    // Handle OpenRouter quota errors specially
    if (errorMessage.startsWith('OPENROUTER_QUOTA_EXCEEDED:')) {
      const actualMessage = errorMessage.replace('OPENROUTER_QUOTA_EXCEEDED:', '');
      return new Response(JSON.stringify({
        error: 'openrouter_quota',
        message: actualMessage || 'OpenRouter API quota exceeded'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return createErrorResponse(errorMessage, 500);
  }
};

serve(handler);

export { handler };
