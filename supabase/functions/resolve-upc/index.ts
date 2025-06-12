/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getFSAccessToken } from "../_shared/fatsecret.ts";

// The SupplementData interface (same as your scoring function)
interface Ingredient {
  name: string;
  dosage?: string;
  form?: string;
}

interface SupplementData {
  product_id: string;
  ingredients: Ingredient[];
  brand: string;
  product_name: string;
  label_claims?: string[];
  certifications?: string[];
  warnings?: string[];
  reviews?: { positive: number; negative: number };
}

async function fetchFromOpenFoodFacts(upc: string): Promise<SupplementData | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${upc}.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
        console.error(`OpenFoodFacts API returned status: ${resp.status}`);
        return null;
    }
    const data = await resp.json();

    // OpenFoodFacts sometimes returns a status field for missing codes
    if (data.status !== 1 || !data.product) {
        console.warn(`UPC ${upc} not found or incomplete data in OpenFoodFacts.`);
        return null;
    }

    // Parse fields into your format (add fallbacks as needed)
    const product = data.product;
    return {
      product_id: product.code ?? upc,
      ingredients: (product.ingredients_text ? [{name: product.ingredients_text}] : (product.ingredients ?? []).map((ing: any) => ({
        name: ing.text ?? ing.name ?? "",
        dosage: undefined, // OFF usually doesn't give dosage, can improve later
        form: undefined
      }))),
      brand: product.brands ?? "Unknown",
      product_name: product.product_name ?? "Unknown",
      label_claims: product.labels_tags?.filter((tag: string) => tag.startsWith("en:")).map((tag: string) => tag.replace("en:", "")) ?? [],
      certifications: [], // OFF doesn't always have this; can scrape from ingredients_analysis_tags if present
      warnings: [],       // Not usually available
      reviews: { positive: 0, negative: 0 } // Optionally add better logic
    };
  } catch (e) {
    console.error("Error fetching from OpenFoodFacts:", e);
    return null;
  }
}

// DSLD API Integration
// Corrected base URL based on your provided sample calls for DSLD API
const DSLD_API_BASE_URL = "https://api.ods.od.nih.gov/dsld/v9";

async function fetchFromDSLD(upc: string): Promise<SupplementData | null> {
  // Ensure the environment variable is loaded for local testing if using .env
  // For Supabase deployment, it should be set via `supabase secrets set`
  console.log("Attempting to retrieve DSLD_API_KEY...");
  const dSldApiKey = Deno.env.get('DSLD_API_KEY');

  if (!dSldApiKey) {
    console.warn("DSLD_API_KEY is not set. Cannot fetch data from DSLD.");
    return null;
  }

  const upcWithQuotes = `"${upc}"`;
  const finalEncodedUpc = encodeURIComponent(upcWithQuotes);

  // FIX 1: Changed ?barcode= back to ?q= as per DSLD documentation and successful direct curl
  const url = `${DSLD_API_BASE_URL}/search-filter?q=${finalEncodedUpc}`;
  
  try {
    console.log("Key present in DSLD fetch:", !!dSldApiKey);
    console.log(`Fetching DSLD URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        // FIX 2: Changed 'x-api-key' to 'X-Api-Key' for consistency with working curl
        'X-Api-Key': dSldApiKey,
        'Content-Type': 'application/json', // Though not always strictly needed for GET, good practice
        'User-Agent': 'Supproo/0.1 (+https://supproo.com)',
      }
    });

    if (!response.ok) {
      console.error(`DSLD API error! Status: ${response.status}, Text: ${await response.text()}`);
      return null;
    }
    const data: any = await response.json(); // Use 'any' for now, as full DSLD response structure isn't known
    console.log("DSLD raw response for UPC:", JSON.stringify(data, null, 2));

    // FIX 3: Corrected JSON parsing to look for 'hits' array within the object response
    if (data.hits && Array.isArray(data.hits) && data.hits.length > 0) {
      const label = data.hits[0]._source; // Access the _source object within the hit

      // Map DSLD data to SupplementData. This mapping is speculative and might need adjustment
      // once you see actual DSLD JSON responses for a given UPC.
      return {
        product_id: upc, // Use the provided UPC as the product_id
        product_name: label.productName ?? label.brandName ?? `DSLD Product (${upc})`, // Prioritize specific product name, fallback to brand or generic
        ingredients: label.ingredientsList ?? label.ingredients ?? [], // Common names for ingredient lists
        brand: label.brandName ?? "Unknown",
        label_claims: label.claims ?? [],
        certifications: label.certifications ?? [],
        warnings: label.warnings ?? [],
        reviews: { positive: 0, negative: 0 } // Placeholder, DSLD doesn't provide reviews directly
      };
    }

    return null; // No data found in DSLD

  } catch (error) {
    console.error("Error fetching from DSLD:", error);
    return null;
  }
}

async function fetchFromFatSecret(upc: string): Promise<SupplementData | null> {
  const token = await getFSAccessToken();
  const url = `https://platform.fatsecret.com/rest/server.api?method=barcode.v2.search&barcode=${upc}&format=json`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const foods = j.barcode?.foods;
  if (!foods?.length) return null;
  const f = foods[0];
  return {
    product_id: upc,
    product_name: f.brand_name ? `${f.brand_name} ${f.food_name}` : f.food_name,
    brand: f.brand_name || "",
    ingredients: typeof f.food_description === "string" ? [{name: f.food_description}] : [],
    label_claims: [],
    certifications: [],
    warnings: [],
    reviews: { positive: 0, negative: 0 },
  };
}

serve(async (req: Request) => {
  // Accept both GET and POST for testing
  const url = new URL(req.url);
  const upc = url.searchParams.get("upc") ||
    (req.method === "POST" ? (await req.json()).upc : undefined);

  if (!upc) {
    return new Response(JSON.stringify({ error: "No UPC provided" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  // Attempt to fetch data from DSLD first
  let data = await fetchFromDSLD(upc);

  // If DSLD doesn't return data, fallback to OpenFoodFacts
  if (!data) {
    console.log("Falling back to OpenFoodFacts for UPC:", upc);
    data = await fetchFromOpenFoodFacts(upc);
  }

  const fat = await fetchFromFatSecret(upc);
  if (fat) {
    console.log("Data found from FatSecret.");
    return new Response(JSON.stringify(fat), { headers: { "Content-Type": "application/json" }, status: 200 });
  }
 
  if (!data) {
    return new Response(
      JSON.stringify({
        error: `UPC '${upc}' not found or failed to fetch data from DSLD, OpenFoodFacts, and FatSecret.`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 404,
      },
    );
  }
 
  console.log("Data from DSLD, OpenFoodFacts, or FatSecret:", JSON.stringify(data, null, 2));
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});