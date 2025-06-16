/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getFSAccessToken } from "../_shared/fatsecret.ts";
import type { SupplementData, Ingredient } from "../../_shared/types.ts";

const DSLD_URL = "https://api.ods.od.nih.gov/dsld/v9/search-filter";

async function fetchFromDSLD(upc: string): Promise<SupplementData | null> {
  const key = Deno.env.get("DSLD_API_KEY");
  if (!key) return null;
  const url = `${DSLD_URL}?q="${encodeURIComponent(upc)}"`;
  try {
    const res = await fetch(url, {
      headers: { "X-Api-Key": key, "Content-Type": "application/json" }
    });
    console.log("DSLD status:", res.status, "body:", await res.clone().text());
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.hits?.[0]?._source;
    if (!hit) return null;
    const ingredients = Array.isArray(hit.ingredientsList)
      ? hit.ingredientsList.map((n: string) => ({ name: n } as Ingredient))
      : [];
    return {
      product_id: upc,
      brand: hit.brandName ?? "",
      product_name: hit.productName ?? hit.brandName ?? upc,
      ingredients,
      label_claims: hit.claims ?? [],
      certifications: hit.certifications ?? [],
      warnings: hit.warnings ?? [],
      reviews: { positive: 0, negative: 0 },
    };
  } catch {
    return null;
  }
}

async function fetchFromFatSecret(upc: string): Promise<SupplementData | null> {
  try {
    const token = await getFSAccessToken();
    const url = `https://platform.fatsecret.com/rest/server.api?method=food.find&id_type=upc&search_expression=${upc}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    console.log("FatSecret status:", res.status, "body:", await res.clone().text());
    if (!res.ok) return null;
    const xml = await res.text();
    // Supabase's edge-runtime already has DOMParser globally – no extra import needed
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const food = doc.querySelector("food");
    if (!food) return null;
    const name = food.querySelector("food_name")?.textContent ?? "";
    const brand = food.querySelector("brand_name")?.textContent ?? "";
    const ing = food.querySelector("ingredients")?.textContent ?? "";
    const ingredients = ing.split(/,|;/).map((s) => s.trim()).filter(Boolean).map((n) => ({ name: n }));
    return {
      product_id: upc,
      brand,
      product_name: brand ? `${brand} ${name}` : name,
      ingredients,
      label_claims: [],
      certifications: [],
      warnings: [],
      reviews: { positive: 0, negative: 0 },
    };
  } catch {
    return null;
  }
}

async function fetchFromOpenFoodFacts(upc: string): Promise<SupplementData | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${upc}.json`;
    const res = await fetch(url);
    console.log("OFF status:", res.status, "body:", await res.clone().text());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1) return null;
    const p = data.product;
    const ingredients: Ingredient[] = [];
    if (Array.isArray(p.ingredients)) {
      for (const i of p.ingredients) {
        if (i.text) ingredients.push({ name: i.text });
      }
    } else if (p.ingredients_text) {
      ingredients.push({ name: p.ingredients_text });
    }
    return {
      product_id: p.code ?? upc,
      brand: p.brands ?? "",
      product_name: p.product_name ?? "Unknown",
      ingredients,
      label_claims: [],
      certifications: [],
      warnings: [],
      reviews: { positive: 0, negative: 0 },
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  console.log("req.method", req.method);
  console.log("req.url ", req.url);
  const upc = new URL(req.url).searchParams.get("upc");
  if (!upc) {
    return new Response(JSON.stringify({ error: "missing upc" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("Trying DSLD for", upc);
  let sourceUsed = "";
  let data = await fetchFromDSLD(upc);
  if (data) {
    sourceUsed = "DSLD";
  } else {
    console.log("DSLD failed, trying FatSecret");
    data = await fetchFromFatSecret(upc);
    if (data) {
      sourceUsed = "FatSecret";
    }
  }
  if (!data) {
    console.log("FatSecret failed, trying OpenFoodFacts");
    data = await fetchFromOpenFoodFacts(upc);
    if (data) {
      sourceUsed = "OpenFoodFacts";
    }
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "UPC not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.log("Resolved via", sourceUsed);
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
