import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url =
    "https://www.transparentlabs.com/products/preseries-bulk-preworkout";
  const fireRes = await fetch(
    `${new URL(req.url).origin}/functions/v1/firecrawl-extract`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
  );

  const result = await fireRes.json();

  if (!fireRes.ok) {
    console.error("❌ Firecrawl Extract Error:", result);
    return new Response(JSON.stringify({ error: result }), {
      status: fireRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
