/// <reference lib="deno.ns" />
import { parseProductPage } from "../parser.ts";
import { assertExists, assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Shopify product page parser", async () => {
  const html = await Deno.readTextFile("./__tests__/fixtures/shopify.html");

  const url = "https://example-shop.myshopify.com/products/sample-product";
  const result = await parseProductPage(html, url, null);

  // Title extraction
  assertExists(result.title);
  assertEquals(result.title, "Premium Whey Protein Isolate");

  // Ingredients extraction
  assertExists(result.ingredients_raw);
  assert(result.ingredients_raw!.length >= 100, `Ingredients length: ${result.ingredients_raw!.length}`);
  assert(result.ingredients_raw!.includes("Whey Protein Isolate 25g"));
  assert(result.ingredients_raw!.includes("L-Leucine 2.5g"));

  // Supplement facts extraction
  assertExists(result.supplement_facts);
  assert(result.supplement_facts!.length >= 200, `Supplement facts length: ${result.supplement_facts!.length}`);
  assert(result.supplement_facts!.includes("SUPPLEMENT FACTS"));
  assert(result.supplement_facts!.includes("Serving Size"));

  // Numeric doses detection
  assertEquals(result.numeric_doses_present, true);

  // Parser steps validation
  assertExists(result._meta?.parserSteps);
  assert(result._meta!.parserSteps!.includes("shopify_generic"), `Parser steps: ${JSON.stringify(result._meta!.parserSteps)}`);
});

Deno.test("Shopify parser with text pattern fallback", async () => {
  const minimalHtml = `
    <html>
    <head>
      <meta name="generator" content="Shopify">
      <title>Test Product</title>
    </head>
    <body>
      <h1 data-product-title>Test Shopify Product</h1>
      <div class="product-description">
        <p>INGREDIENTS: Creatine Monohydrate 5000mg, Beta-Alanine 3200mg, L-Citrulline 6000mg, Taurine 2000mg, Caffeine Anhydrous 200mg, Natural Flavors, Citric Acid, Sucralose.</p>
        
        <div>SUPPLEMENT FACTS - Serving Size: 1 scoop (15g) - Servings per container: 30 - Amount per serving: Creatine Monohydrate 5000mg, Beta-Alanine 3200mg, L-Citrulline 6000mg, Taurine 2000mg, Caffeine Anhydrous 200mg, Vitamin B6 5mg, Magnesium 100mg, Potassium 200mg.</div>
      </div>
    </body>
    </html>
  `;

  const url = "https://test-shop.myshopify.com/products/test-product";
  const result = await parseProductPage(minimalHtml, url, null);

  // Should extract title from data-product-title
  assertExists(result.title);
  assert(result.title!.includes("Test Shopify Product") || result.title === "Test Product");

  // Should extract ingredients from text pattern
  assertExists(result.ingredients_raw);
  assert(result.ingredients_raw!.includes("Creatine Monohydrate 5000mg"));

  // Should extract supplement facts from text pattern
  assertExists(result.supplement_facts);
  assert(result.supplement_facts!.includes("SUPPLEMENT FACTS"));

  // Should detect numeric doses
  assertEquals(result.numeric_doses_present, true);

  // Should include Shopify parser step
  assert(result._meta!.parserSteps!.includes("shopify_generic"));
});
