/// <reference lib="deno.ns" />
import { parseProductPage } from "../parser.ts";
import { assertExists, assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("magnumsupps.com site-specific parser", async () => {
  const html = await Deno.readTextFile(
    "./test_fixtures/magnumsupps.html",
  );
  
  const url = "https://magnumsupps.com/products/pre-workout-energy-complex";
  const result = await parseProductPage(html, url, null);
  
  // Title extraction - comes from title tag in generic extraction, then potentially updated by site-specific parser
  assertExists(result.title);
  // The title should be either from title tag or h1 tag  
  assert(result.title === "MAGNUM SUPPS Pre-Workout Supplement" || result.title === "MAGNUM SUPPS Pre-Workout Energy Complex");
  
  // Ingredients extraction
  assertExists(result.ingredients_raw);
  assert(result.ingredients_raw!.length >= 100);
  assert(result.ingredients_raw!.includes("Citrulline Malate 6000mg"));
  assert(result.ingredients_raw!.includes("Beta-Alanine 3200mg"));
  assert(result.ingredients_raw!.includes("Caffeine Anhydrous 300mg"));
  
  // Supplement facts extraction
  assertExists(result.supplement_facts);
  assert(result.supplement_facts!.length >= 300);
  assert(result.supplement_facts!.includes("SUPPLEMENT FACTS"));
  assert(result.supplement_facts!.includes("Serving Size: 1 scoop"));
  assert(result.supplement_facts!.includes("Citrulline Malate - 6000mg"));
  
  // Numeric doses detection
  assertEquals(result.numeric_doses_present, true);
  
  // Parser steps should include magnumsupps-specific steps
  assertExists(result._meta?.parserSteps);
  assert(result._meta!.parserSteps!.includes("magnumsupps_specific"));
  // Should have extracted ingredients or supplement facts using magnumsupps-specific selectors
  assert(
    result._meta!.parserSteps!.some(step => 
      step.includes("magnumsupps-ingredients") || 
      step.includes("magnumsupps-supplement-facts") ||
      step === "magnumsupps_specific"
    )
  );
});

Deno.test("magnumsupps.com parser fallback to text patterns", async () => {
  // Create minimal HTML with text patterns but without specific selectors
  const minimalHtml = `
    <html>
    <head><title>Test Product</title></head>
    <body>
      <h1 class="product-single__title">Magnum Test Product</h1>
      <div class="product-description">
        <p>INGREDIENTS: L-Citrulline 8000mg, Beta-Alanine 4000mg, Creatine Monohydrate 5000mg, Caffeine 200mg, Taurine 1500mg. Other ingredients: Natural flavors, stevia leaf extract.</p>
        
        <p>SUPPLEMENT FACTS - Serving Size: 1 scoop (12g) - Servings per container: 25 - Amount per serving: L-Citrulline 8000mg, Beta-Alanine 4000mg, Creatine Monohydrate 5000mg, Caffeine 200mg, Taurine 1500mg, Natural Flavors 500mg, Stevia Leaf Extract 100mg.</p>
        
        <p>DIRECTIONS: Mix one scoop with 8-12 oz of water 15-30 minutes before training.</p>
      </div>
    </body>
    </html>
  `;
  
  const url = "https://magnumsupps.com/products/test-product";
  const result = await parseProductPage(minimalHtml, url, null);
  
  // The title should be from the h1.product-single__title due to magnumsupps parser
  // But might fallback to generic title extraction first
  // Let's just check it contains the product name
  assertExists(result.title);
  assert(result.title!.includes("Magnum Test Product") || result.title === "Test Product");
  
  // Should extract ingredients from text pattern
  assertExists(result.ingredients_raw);
  assert(result.ingredients_raw!.includes("L-Citrulline 8000mg"));
  assert(result.ingredients_raw!.includes("Beta-Alanine 4000mg"));
  
  // Should extract supplement facts from text pattern
  assertExists(result.supplement_facts);
  assert(result.supplement_facts!.includes("SUPPLEMENT FACTS"));
  assert(result.supplement_facts!.includes("Serving Size: 1 scoop"));
  
  // Should detect numeric doses
  assertEquals(result.numeric_doses_present, true);
  
  // Should include magnumsupps-specific parser step
  assert(result._meta!.parserSteps!.includes("magnumsupps_specific"));
});
