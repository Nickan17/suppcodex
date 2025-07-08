/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupplementData } from "../../_shared/types.ts";

function postJSON(
  url: URL,
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" },
) {
  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function findOfficialWebsite(name: string): Promise<string | null> {
  const key = Deno.env.get("EXPO_PUBLIC_OPENROUTER_API_KEY");
  if (!key) {
    console.error("findOfficialWebsite: Missing OpenRouter API key");
    return null;
  }
  const model = Deno.env.get("OPENROUTER_SEARCH_MODEL") ?? "openai/gpt-4o-mini";
  const prompt =
    `Return ONLY the official product URL (https://...). If none, return NONE.\n${name}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "text" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`OpenRouter API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content?.trim();
    console.log("findOfficialWebsite: OpenRouter returned →", txt);
    console.log("OpenRouter response text:", txt);

    if (txt && txt.startsWith("http")) return txt;
    return null;
  } catch (error) {
    console.error("Error in findOfficialWebsite:", error);
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req: Request) => {
  // Handle CORS pre-flight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use POST with JSON { upc: "..." }' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {

    let upc: string | null = null;
    // Prepare headers object for all internal fetch calls
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (serviceKey) {
      internalHeaders["authorization"] = `Bearer ${serviceKey}`;
      internalHeaders["apikey"] = serviceKey;
    }

    if (req.method === "GET") {
      upc = new URL(req.url).searchParams.get("upc");
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        upc = body.upc;
      } catch (e) {
        console.error("Error parsing POST body:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (!upc) {
      return new Response(JSON.stringify({ error: "missing upc" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1. Call resolve-upc function
    const baseUrl = "https://uaqcehoocecvihubnbhp.supabase.co";
    const resolveUpcUrl = new URL(`${baseUrl}/functions/v1/resolve-upc/`);
    resolveUpcUrl.searchParams.set("upc", upc);
    const r = await fetch(resolveUpcUrl.toString(), {
      headers: internalHeaders,
    });
    const resolveUpcResponseText = await r.text();
    if (!r.ok) {
      return new Response(resolveUpcResponseText, {
        status: r.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const data: SupplementData = JSON.parse(resolveUpcResponseText);

    // 2. Find official website using OpenRouter
    const url = await findOfficialWebsite(`${data.brand} ${data.product_name}`);

    let scraped: string | null = null;

    if (url) {
      const firecrawlUrl = new URL(
        `${baseUrl}/functions/v1/firecrawl-extract/`,
      );
      const fireRes = await fetch(firecrawlUrl.toString(), {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ url }),
      });

      if (fireRes.ok) {
        const fireJson = await fireRes.json();
        scraped = fireJson?.data?.content ?? null;
      } else {
        const txt = await fireRes.text();
        console.error(
          `firecrawl-extract call failed ${fireRes.status}: ${txt}`,
        );
      }
    }

    // 4. Call score-supplement function
    const scoreUrl = new URL(`${baseUrl}/functions/v1/score-supplement/`);
    const sr = await postJSON(scoreUrl, { data, scraped }, internalHeaders);

    // 5. Return the final response from score-supplement
    const finalResponseText = await sr.text();
    if (!sr.ok) {
      console.error(
        `Error from score-supplement: ${sr.status} ${finalResponseText}`,
      );
    } else {
      const final = JSON.parse(finalResponseText);
      console.log("score-supplement OK final_score:", final.final_score);
    }
    return new Response(finalResponseText, {
      status: sr.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Unhandled error in main serve function:", e);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
