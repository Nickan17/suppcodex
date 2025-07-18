import {
  assert,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parseProductPage } from "../supabase/functions/firecrawl-extract/parser.ts";

Deno.test("parseProductPage - Quattro Fixture Test", async () => {
  // Read the HTML fixture
  const htmlFixturePath = "./supabase/functions/firecrawl-extract/fixtures/quattro_live.html";
  const htmlContent = await Deno.readTextFile(htmlFixturePath);
  
  // Read the OCR fixture (optional)
  const ocrFixturePath = "./supabase/functions/firecrawl-extract/fixtures/quattro_live_ocr.txt";
  let ocrContent: string | null = null;
  try {
    ocrContent = await Deno.readTextFile(ocrFixturePath);
  } catch (_error) {
    // OCR fixture is optional
    console.log("OCR fixture not found, proceeding without OCR data");
  }
  
  // Parse the product page
  const parsed = await parseProductPage(
    htmlContent,
    "https://magnumsupps.com/en-us/products/quattro",
    ocrContent
  );
  
  // Assert title exists and contains "Quattro"
  assertExists(parsed.title);
  assert(parsed.title.toLowerCase().includes("quattro"));
  
  // Assert ingredients_raw exists and is >200 chars
  assertExists(parsed.ingredients_raw);
  assert(parsed.ingredients_raw.length > 200);
  
  // Assert numeric_doses_present === true
  assert(parsed.numeric_doses_present === true);
  
  // Assert supplement_facts length > 300 (if OCR provided)
  if (ocrContent && parsed.supplement_facts) {
    assert(parsed.supplement_facts.length > 300);
  }
  
  console.log("✅ Quattro fixture test passed");
  console.log(`   Title: ${parsed.title}`);
  console.log(`   Ingredients length: ${parsed.ingredients_raw?.length || 0} characters`);
  console.log(`   Numeric doses present: ${parsed.numeric_doses_present}`);
  console.log(`   Supplement facts length: ${parsed.supplement_facts?.length || 0} characters`);
}); 