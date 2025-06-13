/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupplementData } from "../../_shared/types.ts";

async function findOfficialWebsite(name: string): Promise<string | null> {
  const key = Deno.env.get("EXPO_PUBLIC_OPENROUTER_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("OPENROUTER_SEARCH_MODEL") ?? "openai/gpt-4o-mini";
  const prompt = `Return ONLY the official product URL (https://...). If none, return NONE.\n${name}`;
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
  if (!res.ok) return null;
  const j = await res.json();
  const txt = j.choices?.[0]?.message?.content?.trim();
  if (txt && txt.startsWith("http")) return txt;
  return null;
}

serve(async (req) => {
  const upc = new URL(req.url).searchParams.get("upc");
  if (!upc) return new Response(JSON.stringify({ error: "missing upc" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const base = new URL(req.url);
  base.pathname = "/functions/v1/resolve-upc";
  base.search = `upc=${encodeURIComponent(upc)}`;
  let r = await fetch(base.toString());
  if (!r.ok) return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
  const data: SupplementData = await r.json();

  const url = await findOfficialWebsite(`${data.brand} ${data.product_name}`);
  let scraped: string | null = null;
  if (url) {
    console.log("Website found:", url);
    const f = new URL(req.url);
    f.pathname = "/functions/v1/firecrawl-extract";
    f.search = `url=${encodeURIComponent(url)}`;
    const fr = await fetch(f.toString());
    if (fr.ok) {
      const fj = await fr.json();
      scraped = fj.content ?? null;
    }
  } else {
    console.log("No official website found");
  }

  const s = new URL(req.url);
  s.pathname = "/functions/v1/score-supplement";
  const body = JSON.stringify({ data, scraped });
  r = await fetch(s.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
});
