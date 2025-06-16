/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupplementData } from "../../_shared/types.ts";

async function postJSON(url: URL, body: unknown) {
  return fetch(url.toString(), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
}

// Helper function to log fetch calls
async function logCall(label: string, res: Response) {
  const status = res.status;
  const statusText = res.statusText;
  let logMessage = `${label}: ${status} ${statusText}`;

  if (!res.ok) {
    try {
      const bodyText = await res.clone().text();
      const bodySnippet = bodyText.substring(0, 500);
      logMessage += ` Body: ${bodySnippet}`;
    } catch (e) {
      logMessage += ` (Failed to read body: ${e.message})`;
    }
  }
  console.log(logMessage);
}

async function findOfficialWebsite(name: string): Promise<string | null> {
  const key = Deno.env.get("EXPO_PUBLIC_OPENROUTER_API_KEY");
  if (!key) {
    console.error("findOfficialWebsite: Missing OpenRouter API key");
    return null;
  }
  const model = Deno.env.get("OPENROUTER_SEARCH_MODEL") ?? "openai/gpt-4o-mini";
  const prompt = `Return ONLY the official product URL (https://...). If none, return NONE.\n${name}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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

serve(async (req) => {
  let upc: string | null = null;
  // Prepare headers object for all internal fetch calls
  const anonKey = Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const internalHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (anonKey) {
    internalHeaders["authorization"] = `Bearer ${anonKey}`;
    internalHeaders["apikey"] = anonKey;
  }

  if (req.method === 'GET') {
    upc = new URL(req.url).searchParams.get("upc");
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      upc = body.upc;
    } catch (e) {
      console.error("Error parsing POST body:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  if (!upc) {
    return new Response(JSON.stringify({ error: "missing upc" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // 1. Call resolve-upc function
  const base = new URL(req.url);
  base.pathname = "/functions/v1/resolve-upc";
  // resolve-upc expects GET with query param
  let r = await fetch(base.toString() + `?upc=${encodeURIComponent(upc)}`, {
    headers: internalHeaders
  });
  await logCall('resolve-upc', r);
  const resolveUpcResponseText = await r.text();
  if (!r.ok) {
    return new Response(resolveUpcResponseText, { status: r.status, headers: { "Content-Type": "application/json" } });
  }
  const data: SupplementData = JSON.parse(resolveUpcResponseText);

   // 2. Find official website using OpenRouter
   const url = await findOfficialWebsite(`${data.brand} ${data.product_name}`);

   let scraped: string | null = null;

if (url) {
  console.log("Website found:", url);

  const fireUrl = new URL("/functions/v1/firecrawl-extract", req.url);

  const fireRes = await fetch(fireUrl.toString(), {
    method: "POST",
    headers: {
      ...internalHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  await logCall("firecrawl-extract", fireRes);

  if (fireRes.ok) {
    const fireJson = await fireRes.json();
    scraped = fireJson.content ?? null;
    console.log("Firecrawl content length:", scraped?.length ?? 0);
  } else {
    const txt = await fireRes.text();
    console.error(`firecrawl-extract error ${fireRes.status}: ${txt}`);
  }
} else {
  console.log("No official website found");
}

   // 4. Call score-supplement function
  const scoreUrl = new URL(req.url);
  scoreUrl.pathname = "/functions/v1/score-supplement";
  const sr = await postJSON(scoreUrl, {data, scraped});
  await logCall('score-supplement', sr);

  // 5. Return the final response from score-supplement
  const finalResponseText = await sr.text();
  if (!sr.ok) {
    console.error(`Error from score-supplement: ${sr.status} ${finalResponseText}`);
  } else {
    const final = JSON.parse(finalResponseText);
    console.log('score-supplement OK final_score:', final.final_score);
  }
  return new Response(finalResponseText, { status: sr.status, headers: { "Content-Type": "application/json" } });
});