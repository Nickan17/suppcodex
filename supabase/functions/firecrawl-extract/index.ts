/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed. Use POST with JSON { url:\"...\" }" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  let url: string | undefined;
  try {
    ({ url } = await req.json());
  } catch {
    /* ignore – handled below */
  }
  if (!url || typeof url !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing url field in JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: "FIRECRAWL_API_KEY not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const prompt =
    "Extract all visible ingredient data including dosages, supplement facts, quality certifications, and price per serving. Also return any supplement label image URLs.";

  const requestBodyForFirecrawl = JSON.stringify({
    url,
    params: {
      extractorOptions: {
        mode: "llm",
        llmOptions: { prompt },
      },
      usePuppeteer: false,
    },
  });

  const firecrawlUrl = "https://api.firecrawl.dev/v0/extract"; // CORRECTED ENDPOINT
  console.log("→ Firecrawl POST", firecrawlUrl, { url, prompt }); // DEBUG log

  const fireRes = await fetch(firecrawlUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: requestBodyForFirecrawl,
  });

  if (!fireRes.ok) {
    const txt = await fireRes.text();
    console.error("Firecrawl API error:", fireRes.status, txt.slice(0, 300));
    return new Response(
      JSON.stringify({ error: `Firecrawl API error ${fireRes.status}`, detail: txt }),
      { status: fireRes.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await fireRes.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});