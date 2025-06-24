/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  console.log("💡 FCE", req.method, "body:", await req.clone().text());

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed. Use POST with JSON { url:"..." }',
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  let url: string | undefined;
  try {
    ({ url } = await req.json());
  } catch (e) {
    console.error("Error parsing JSON from request body:", e);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!url || typeof url !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing url field in JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const fcRes = await fetch("https://api.firecrawl.dev/v1/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      urls: [url], // url from req.json()
      prompt:
        "Extract ingredients (name, dosage, form), certifications, price per serving, label image URLs.",
      agent: { model: "FIRE-1" },
    }),
  });

  if (!fcRes.ok) {
    const txt = await fcRes.text();
    console.error("Firecrawl API error:", fcRes.status, txt.slice(0, 300));
    return new Response(
      JSON.stringify({
        error: `Firecrawl API error ${fcRes.status}`,
        detail: txt,
      }),
      { status: fcRes.status, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await fcRes.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
