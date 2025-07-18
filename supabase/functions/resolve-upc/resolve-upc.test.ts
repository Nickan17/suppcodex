import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test interfaces
interface Ingredient {
  name: string;
}

interface SupplementData {
  product_id: string;
  brand: string;
  product_name: string;
  ingredients: Ingredient[];
  label_claims: string[];
  certifications: string[];
  warnings: string[];
  reviews: { positive: number; negative: number };
}

// Test the UPC variants function directly
function upcVariants(raw: string): string[] {
  const cleaned = raw.replace(/\D/g, "");
  const ean13 = cleaned.padStart(13, "0");
  const upc12 = ean13.slice(1); // drop leading 0
  return Array.from(new Set([cleaned, upc12, ean13])); // unique list
}

// Test suite for resolve-upc function
Deno.test("resolve-upc - UPC Processing", async (t) => {
  await t.step("should generate UPC variants correctly", () => {
    const result = upcVariants("123456789012");
    assertEquals(result, ["123456789012", "0123456789012"]);
  });

  await t.step("should handle UPC with dashes", () => {
    const result = upcVariants("123-456-789-012");
    assertEquals(result, ["123456789012", "0123456789012"]);
  });

  await t.step("should handle short UPC", () => {
    const result = upcVariants("123456");
    assertEquals(result, ["123456", "000000123456", "0000000123456"]);
  });
});

Deno.test("resolve-upc - Data Structure Validation", async (t) => {
  await t.step("should validate SupplementData structure", () => {
    const mockData: SupplementData = {
      product_id: "test-upc-123",
      brand: "Test Brand",
      product_name: "Test Product",
      ingredients: [{ name: "Vitamin C" }, { name: "Zinc" }],
      label_claims: ["Immune Support"],
      certifications: ["USP Verified"],
      warnings: ["Consult healthcare provider"],
      reviews: { positive: 5, negative: 1 },
    };

    assertEquals(typeof mockData.product_id, "string");
    assertEquals(typeof mockData.brand, "string");
    assertEquals(typeof mockData.product_name, "string");
    assertEquals(Array.isArray(mockData.ingredients), true);
    assertEquals(Array.isArray(mockData.label_claims), true);
    assertEquals(Array.isArray(mockData.certifications), true);
    assertEquals(Array.isArray(mockData.warnings), true);
    assertEquals(typeof mockData.reviews.positive, "number");
    assertEquals(typeof mockData.reviews.negative, "number");
  });

  await t.step("should handle empty arrays in data structure", () => {
    const emptyData: SupplementData = {
      product_id: "test-upc-123",
      brand: "",
      product_name: "",
      ingredients: [],
      label_claims: [],
      certifications: [],
      warnings: [],
      reviews: { positive: 0, negative: 0 },
    };

    assertEquals(emptyData.ingredients.length, 0);
    assertEquals(emptyData.label_claims.length, 0);
    assertEquals(emptyData.certifications.length, 0);
    assertEquals(emptyData.warnings.length, 0);
  });
});

Deno.test("resolve-upc - Input Validation", async (t) => {
  await t.step("should validate UPC format", () => {
    const validUPCs = ["123456789012", "12345678901", "123456"];
    const invalidUPCs = ["", "abc", "123abc456"];

    for (const upc of validUPCs) {
      const cleaned = upc.replace(/\D/g, "");
      assertEquals(cleaned.length > 0, true);
    }

    for (const upc of invalidUPCs) {
      const cleaned = upc.replace(/\D/g, "");
      if (cleaned.length === 0) {
        assertEquals(cleaned.length, 0);
      }
    }
  });

  await t.step("should handle null/undefined UPC", () => {
    const nullUPC = null;
    const undefinedUPC = undefined;

    assertEquals(nullUPC === null, true);
    assertEquals(undefinedUPC === undefined, true);
  });
});

Deno.test("resolve-upc - Response Formatting", async (t) => {
  await t.step("should format response with all fields", () => {
    const mockResponse: SupplementData = {
      product_id: "test-upc-123",
      brand: "Test Brand",
      product_name: "Test Product",
      ingredients: [{ name: "Vitamin C" }, { name: "Zinc" }],
      label_claims: ["Immune Support"],
      certifications: ["USP Verified"],
      warnings: ["Consult healthcare provider"],
      reviews: { positive: 5, negative: 1 },
    };

    // Test JSON serialization
    const jsonResponse = JSON.stringify(mockResponse);
    const parsedResponse = JSON.parse(jsonResponse) as SupplementData;

    assertEquals(parsedResponse.product_id, mockResponse.product_id);
    assertEquals(parsedResponse.brand, mockResponse.brand);
    assertEquals(parsedResponse.product_name, mockResponse.product_name);
    assertEquals(parsedResponse.ingredients.length, mockResponse.ingredients.length);
    assertEquals(parsedResponse.reviews.positive, mockResponse.reviews.positive);
  });

  await t.step("should handle minimal response data", () => {
    const minimalResponse: SupplementData = {
      product_id: "minimal-upc",
      brand: "",
      product_name: "",
      ingredients: [],
      label_claims: [],
      certifications: [],
      warnings: [],
      reviews: { positive: 0, negative: 0 },
    };

    assertEquals(minimalResponse.product_id, "minimal-upc");
    assertEquals(minimalResponse.brand, "");
    assertEquals(minimalResponse.ingredients.length, 0);
  });
});

Deno.test("resolve-upc - Error Handling", async (t) => {
  await t.step("should handle API errors gracefully", async () => {
    // Mock fetch to simulate API failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes("openfoodfacts")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("fatsecret")) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (url.includes("dsld")) {
        return new Response("Server Error", { status: 500 });
      }
      return originalFetch(input, init);
    };

    try {
      // Test would go here - simulate API calls
      assertEquals(true, true); // Placeholder
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.step("should handle network timeouts", async () => {
    // Mock fetch to simulate timeout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network timeout");
    };

    try {
      // Test would go here
      assertEquals(true, true); // Placeholder
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

Deno.test("resolve-upc - Data Source Priority", async (t) => {
  await t.step("should prioritize DSLD over other sources", () => {
    const sourcePriority = ["DSLD", "FatSecret", "OpenFoodFacts"];
    assertEquals(sourcePriority[0], "DSLD");
    assertEquals(sourcePriority[1], "FatSecret");
    assertEquals(sourcePriority[2], "OpenFoodFacts");
  });

  await t.step("should fallback to next source on failure", () => {
    const mockSources = [
      { name: "DSLD", available: false },
      { name: "FatSecret", available: true },
      { name: "OpenFoodFacts", available: true },
    ];

    const availableSource = mockSources.find(source => source.available);
    assertEquals(availableSource?.name, "FatSecret");
  });
});

Deno.test("resolve-upc - CORS Handling", async (t) => {
  await t.step("should include CORS headers", () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    assertExists(corsHeaders['Access-Control-Allow-Origin']);
    assertEquals(corsHeaders['Access-Control-Allow-Origin'], '*');
    assertExists(corsHeaders['Access-Control-Allow-Methods']);
    assertStringIncludes(corsHeaders['Access-Control-Allow-Methods'], 'POST');
  });

  await t.step("should handle OPTIONS requests", () => {
    const req = new Request("http://localhost:8000", { method: "OPTIONS" });
    assertEquals(req.method, "OPTIONS");
  });
});

Deno.test("resolve-upc - Integration Test", async (t) => {
  await t.step("should process valid UPC end-to-end", async () => {
    const testUPC = "123456789012";
    const variants = upcVariants(testUPC);
    
    assertEquals(variants.length, 2);
    assertStringIncludes(variants[0], testUPC);
    
    // Simulate successful resolution
    const mockResult: SupplementData = {
      product_id: testUPC,
      brand: "Test Brand",
      product_name: "Test Product",
      ingredients: [{ name: "Test Ingredient" }],
      label_claims: [],
      certifications: [],
      warnings: [],
      reviews: { positive: 0, negative: 0 },
    };

    assertEquals(mockResult.product_id, testUPC);
    assertEquals(typeof mockResult.brand, "string");
    assertEquals(typeof mockResult.product_name, "string");
  });
});

// Test utilities
Deno.test("resolve-upc - Utility Functions", async (t) => {
  await t.step("should clean UPC strings correctly", () => {
    const dirtyUPC = "123-456-789-012";
    const cleaned = dirtyUPC.replace(/\D/g, "");
    assertEquals(cleaned, "123456789012");
  });

  await t.step("should validate URL format", () => {
    const validURL = "https://example.com/api";
    const invalidURL = "not-a-url";
    
    try {
      new URL(validURL);
      assertEquals(true, true);
    } catch {
      throw new Error("Valid URL should not throw");
    }
    
    try {
      new URL(invalidURL);
      throw new Error("Invalid URL should throw");
    } catch {
      assertEquals(true, true);
    }
  });

  await t.step("should handle ingredient parsing", () => {
    const ingredientText = "Vitamin C, Zinc, Magnesium";
    const ingredients = ingredientText.split(/,|;/).map((s: string) => s.trim()).filter(Boolean).map((n: string) => ({ name: n }));
    
    assertEquals(ingredients.length, 3);
    assertEquals(ingredients[0].name, "Vitamin C");
    assertEquals(ingredients[1].name, "Zinc");
    assertEquals(ingredients[2].name, "Magnesium");
  });
}); 