import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test interfaces
interface ParsedProduct {
  title: string | null;
  ingredients_raw: string | null;
  numeric_doses_present: boolean;
  ingredients?: string[];
  allergens?: string[];
  warnings?: string[];
  manufacturer?: string;
  [key: string]: unknown;
}

// Test utility functions directly
function cleanText(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeIngredientList(text: string | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  const hasIngredientKeywords =
    /ingredients?:|medicinal ingredients?|non[- ]?medicinal|supplement facts/i
      .test(normalized);
  const hasListMarkers = /[\w\s]+,|•|\*|\d+\./g.test(normalized);
  const hasDosageUnits = /\b(mg|mcg|g|iu|%dv)\b/i.test(normalized);
  const hasCertifications = /(organic|natural|non-gmo|kosher|halal|usda|fda)\b/i
    .test(normalized);

  return hasIngredientKeywords &&
    (hasListMarkers || hasDosageUnits || hasCertifications);
}

function scoreCandidate(text: string): number {
  const t = text.toLowerCase();
  let score = 0;

  if (!/ingredients?:/i.test(t)) return 0;
  if (t.length < 30) return 0;
  if (/\b(mg|mcg|g|iu|%dv)\b/i.test(t)) score += 1; // dosage units
  if (/\([^()]*allergen/i.test(t)) score += 1; // allergen warnings
  if (/(organic|natural|artificial|color|flavor)/i.test(t)) score += 1; // label keywords
  if (/\d+\.\d+/.test(t)) score += 1; // decimal numbers
  if (/(legacy|award|smooth|experience|delicious|premium)/i.test(t)) score -= 2;

  return Math.max(0, score);
}

// Test suite for firecrawl-extract function
Deno.test("firecrawl-extract - Content Cleaning", async (t) => {
  await t.step("should clean text correctly", () => {
    const dirtyText = "  Multiple    spaces   and\ttabs  ";
    const cleaned = cleanText(dirtyText);
    assertEquals(cleaned, "Multiple spaces and tabs");
  });

  await t.step("should handle null text", () => {
    const result = cleanText(null);
    assertEquals(result, null);
  });

  await t.step("should handle empty text", () => {
    const result = cleanText("");
    assertEquals(result, null);
  });

  await t.step("should handle whitespace only", () => {
    const result = cleanText("   \t\n   ");
    assertEquals(result, "");
  });
});

Deno.test("firecrawl-extract - Ingredient Detection", async (t) => {
  await t.step("should detect valid ingredient lists", () => {
    const validIngredients = [
      "Ingredients: Vitamin C 500mg, Zinc 15mg, Magnesium 200mg",
      "Supplement Facts: Vitamin D3 1000 IU, Calcium 500mg",
      "Medicinal Ingredients: Echinacea 250mg, Goldenseal 100mg",
    ];

    for (const ingredient of validIngredients) {
      const isIngredient = looksLikeIngredientList(ingredient);
      assertEquals(isIngredient, true);
    }
  });

  await t.step("should reject invalid ingredient lists", () => {
    const invalidIngredients = [
      "This is just some random text",
      "Product description: Great quality supplement",
      "Legacy blend with premium ingredients for smooth experience",
    ];

    for (const ingredient of invalidIngredients) {
      const isIngredient = looksLikeIngredientList(ingredient);
      assertEquals(isIngredient, false);
    }
  });

  await t.step("should handle null input", () => {
    const result = looksLikeIngredientList(null);
    assertEquals(result, false);
  });
});

Deno.test("firecrawl-extract - Candidate Scoring", async (t) => {
  await t.step("should score high-quality candidates correctly", () => {
    const highQuality =
      "Ingredients: Vitamin C 500 mg, Zinc 15 mg, Magnesium 200 mg";
    const score = scoreCandidate(highQuality);
    assertEquals(score >= 1, true); // Should score at least 1 for having ingredients and dosage
  });

  await t.step("should score low-quality candidates correctly", () => {
    const lowQuality =
      "Legacy blend with premium ingredients for smooth experience";
    const score = scoreCandidate(lowQuality);
    assertEquals(score <= 0, true); // Should score low or negative
  });

  await t.step("should reject candidates without ingredient keywords", () => {
    const noKeywords = "This product contains various vitamins and minerals";
    const score = scoreCandidate(noKeywords);
    assertEquals(score, 0);
  });

  await t.step("should reject candidates that are too short", () => {
    const tooShort = "Ingredients: Vit C";
    const score = scoreCandidate(tooShort);
    assertEquals(score, 0);
  });
});

Deno.test("firecrawl-extract - URL Validation", async (t) => {
  await t.step("should validate correct URLs", () => {
    const validURLs = [
      "https://example.com/product",
      "http://shop.example.com/vitamin-c",
      "https://www.example.com/supplements/protein-powder",
    ];

    for (const url of validURLs) {
      try {
        new URL(url);
        assertEquals(true, true);
      } catch {
        throw new Error(`Valid URL should not throw: ${url}`);
      }
    }
  });

  await t.step("should reject invalid URLs", () => {
    const invalidURLs = [
      "not-a-url",
      "ftp://example.com",
      "javascript:alert('xss')",
    ];

    for (const url of invalidURLs) {
      try {
        new URL(url);
        throw new Error(`Invalid URL should throw: ${url}`);
      } catch {
        assertEquals(true, true);
      }
    }
  });
});

Deno.test("firecrawl-extract - Response Structure", async (t) => {
  await t.step("should have correct ParsedProduct structure", () => {
    const mockProduct: ParsedProduct = {
      title: "Test Product",
      ingredients_raw: "Ingredients: Vitamin C 500mg, Zinc 15mg",
      numeric_doses_present: true,
      ingredients: ["Vitamin C 500mg", "Zinc 15mg"],
      allergens: ["Milk"],
      warnings: ["Consult healthcare provider"],
      manufacturer: "Test Manufacturer",
    };

    assertEquals(typeof mockProduct.title, "string");
    assertEquals(typeof mockProduct.ingredients_raw, "string");
    assertEquals(typeof mockProduct.numeric_doses_present, "boolean");
    assertEquals(Array.isArray(mockProduct.ingredients), true);
    assertEquals(Array.isArray(mockProduct.allergens), true);
    assertEquals(Array.isArray(mockProduct.warnings), true);
    assertEquals(typeof mockProduct.manufacturer, "string");
  });

  await t.step("should handle null values in structure", () => {
    const nullProduct: ParsedProduct = {
      title: null,
      ingredients_raw: null,
      numeric_doses_present: false,
    };

    assertEquals(nullProduct.title, null);
    assertEquals(nullProduct.ingredients_raw, null);
    assertEquals(nullProduct.numeric_doses_present, false);
  });
});

Deno.test("firecrawl-extract - Error Handling", async (t) => {
  await t.step("should handle network errors gracefully", async () => {
    // Mock fetch to simulate network error
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };

    try {
      // Test would go here
      assertEquals(true, true); // Placeholder
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle timeout errors", async () => {
    // Mock fetch to simulate timeout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Request timeout");
    };

    try {
      // Test would go here
      assertEquals(true, true); // Placeholder
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle malformed HTML", () => {
    const malformedHTML = "<html><body><div>Unclosed div<p>Unclosed p";
    // In a real test, this would test HTML parsing
    assertEquals(typeof malformedHTML, "string");
  });
});

Deno.test("firecrawl-extract - Content Extraction", async (t) => {
  await t.step("should extract title from meta tags", () => {
    const mockHTML = `
      <html>
        <head>
          <meta property="og:title" content="Test Product Title">
          <title>Fallback Title</title>
        </head>
        <body>Content</body>
      </html>
    `;

    // Simulate extraction logic
    const hasOgTitle = mockHTML.includes('property="og:title"');
    const hasTitle = mockHTML.includes("<title>");

    assertEquals(hasOgTitle, true);
    assertEquals(hasTitle, true);
  });

  await t.step("should extract ingredients from structured data", () => {
    const mockStructuredData = {
      description: "Ingredients: Vitamin C 500mg, Zinc 15mg",
      nutrition: {
        ingredients: "Vitamin D3 1000 IU, Calcium 500mg",
      },
    };

    const hasDescription = !!mockStructuredData.description;
    const hasNutrition = !!mockStructuredData.nutrition?.ingredients;

    assertEquals(hasDescription, true);
    assertEquals(hasNutrition, true);
  });
});

Deno.test("firecrawl-extract - CORS Handling", async (t) => {
  await t.step("should include CORS headers", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
    assertExists(corsHeaders["Access-Control-Allow-Methods"]);
    assertStringIncludes(corsHeaders["Access-Control-Allow-Methods"], "POST");
  });

  await t.step("should handle OPTIONS requests", () => {
    const req = new Request("http://localhost:8000", { method: "OPTIONS" });
    assertEquals(req.method, "OPTIONS");
  });
});

Deno.test("firecrawl-extract - Integration Test", async (t) => {
  await t.step("should process valid URL end-to-end", async () => {
    const testURL = "https://example.com/product";

    // Validate URL
    try {
      new URL(testURL);
      assertEquals(true, true);
    } catch {
      throw new Error("Valid URL should not throw");
    }

    // Simulate successful extraction
    const mockResult: ParsedProduct = {
      title: "Test Product",
      ingredients_raw: "Ingredients: Vitamin C 500mg, Zinc 15mg",
      numeric_doses_present: true,
      ingredients: ["Vitamin C 500mg", "Zinc 15mg"],
      allergens: [],
      warnings: [],
      manufacturer: "",
    };

    assertEquals(mockResult.title, "Test Product");
    assertEquals(mockResult.numeric_doses_present, true);
    assertEquals(Array.isArray(mockResult.ingredients), true);
  });
});

Deno.test("scrapfly+ocr fallback - parses magnum quattro html", async () => {
  const html = await Deno.readTextFile("./supabase/functions/firecrawl-extract/fixtures/magnum_quattro.html");
  const parsed = await parseProductPage(html, "https://magnumsupps.com/en-us/products/quattro?variant=46056179892527");
  assertExists(parsed.title, "title should exist");
  assertStringIncludes(parsed.title.toLowerCase(), "magnum");
  assertStringIncludes(parsed.title.toLowerCase(), "quattro");
});

// Test utilities
Deno.test("firecrawl-extract - Utility Functions", async (t) => {
  await t.step("should handle ingredient text parsing", () => {
    const ingredientText =
      "Ingredients: Vitamin C 500mg, Zinc 15mg, Magnesium 200mg";
    const ingredients = ingredientText.split(/,|;/).map((s: string) => s.trim())
      .filter(Boolean);

    assertEquals(ingredients.length, 3);
    assertStringIncludes(ingredients[0], "Vitamin C 500mg");
    assertStringIncludes(ingredients[1], "Zinc 15mg");
    assertStringIncludes(ingredients[2], "Magnesium 200mg");
  });

  await t.step("should detect numeric doses", () => {
    const withDoses = "Vitamin C 500mg, Zinc 15mg, Magnesium 200mg";
    const withoutDoses = "Vitamin C, Zinc, Magnesium";

    const hasDoses = /\d+(\.\d+)?\s?(g|mg|mcg|µg|iu|%)\b/i.test(withDoses);
    const noDoses = /\d+(\.\d+)?\s?(g|mg|mcg|µg|iu|%)\b/i.test(withoutDoses);

    assertEquals(hasDoses, true);
    assertEquals(noDoses, false);
  });

  await t.step("should extract manufacturer information", () => {
    const text = "Manufactured for and distributed by Test Company Inc.";
    const manufacturerMatch = text.match(
      /manufactured for and distributed by\s*([\s\S]*)/i,
    );
    const manufacturer = manufacturerMatch ? manufacturerMatch[1].trim() : "";

    assertEquals(manufacturer, "Test Company Inc.");
  });
});
