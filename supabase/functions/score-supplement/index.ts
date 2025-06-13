/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupplementData, SimplifiedAIResponse, FullSupplementScoreResponse } from "../../_shared/types.ts";

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
      strengths: r.highlights.slice(0, 1),
      weaknesses: [],
      recommendations: r.highlights.slice(1),
      safety_rating: "—",
      efficacy_rating: "—",
      transparency_rating: "—",
    },
    sources: [],
    timestamp: new Date().toISOString(),
    confidence_score: 0.9,
  };
}

async function score(data: SupplementData, scraped: string | null): Promise<SimplifiedAIResponse> {
  const key = Deno.env.get("EXPO_PUBLIC_OPENROUTER_API_KEY");
  if (!key) throw new Error("OpenRouter API key missing");
  const prompt = `You are SupplementScoreAI. Using the provided data and optional scraped text, score the product. Return ONLY minified JSON with keys pid,t,dose,qual,risk,highlights.\nDATA:${JSON.stringify(data)}\nSCRAPED:${scraped ?? "NONE"}`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const j = await res.json();
  const txt = j.choices?.[0]?.message?.content ?? "";
  return JSON.parse(txt) as SimplifiedAIResponse;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const { data, scraped }: { data: SupplementData; scraped: string | null } = await req.json();
    const simple = await score(data, scraped);
    const full = expandToFull(simple, data.product_name);

    const supabase = createClient(
      Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!,
      Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!,
    );
    await supabase.from("scored_products").upsert([full], { onConflict: "product_id" });
    return new Response(JSON.stringify(full), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
