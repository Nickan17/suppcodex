import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test interfaces
interface ParsedProduct {
  _meta?: {
    source: string;
  };
  title: string | null;
  ingredients_raw: string | null;
  numeric_doses_present: boolean;
  ingredients?: string[];
  allergens?: string[];
  warnings?: string[];
  manufacturer?: string;
  [key: string]: unknown;
}

// Test the Quattro product page extraction
Deno.test("firecrawl-extract - Quattro Integration Test", async (t) => {
  await t.step("should extract Quattro product data successfully", async () => {
    const testURL =
      "https://magnumsupps.com/en-us/products/quattro?variant=46056179892527";

    // Get Supabase configuration from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL environment variable is required");
    }

    const edgeKey = Deno.env.get("SUPABASE_EDGE_FUNCTION_KEY");

    // Get API keys from environment (test secrets for PRs, production for main)
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    const scraperApiKey = Deno.env.get("SCRAPERAPI_KEY");
    const scrapflyApiKey = Deno.env.get("SCRAPFLY_API_KEY");

    if (!firecrawlApiKey && !scraperApiKey && !scrapflyApiKey) {
      throw new Error("No API keys available for testing");
    }

    // Make request to live Supabase firecrawl-extract function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/firecrawl-extract`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(edgeKey ? { apikey: edgeKey } : {}),
        },
        body: JSON.stringify({ url: testURL }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP ${response.status}: ${errorText}`);
      throw new Error(`Request failed with status ${response.status}`);
    }

    const result: ParsedProduct = await response.json();

    // Validate _meta.source field
    assertExists(result._meta, "_meta field should exist");
    assertExists(result._meta.source, "_meta.source field should exist");
    const validSources = ["firecrawl", "scrapfly", "scraperapi"];
    assertEquals(
      validSources.includes(result._meta.source),
      true,
      `_meta.source should be one of: ${validSources.join(", ")}`,
    );

    // Validate title contains "Quattro"
    assertExists(result.title, "title field should exist");
    assertStringIncludes(
      result.title.toLowerCase(),
      "quattro",
      "title should contain 'Quattro'",
    );

    // Validate ingredients_raw is non-empty and contains expected content
    assertExists(result.ingredients_raw, "ingredients_raw field should exist");
    assertEquals(
      result.ingredients_raw.length > 0,
      true,
      "ingredients_raw should not be empty",
    );
    assertStringIncludes(
      result.ingredients_raw.toLowerCase(),
      "isolated protein",
      "ingredients_raw should contain 'isolated protein'",
    );

    // Validate numeric_doses_present is true
    assertEquals(
      result.numeric_doses_present,
      true,
      "numeric_doses_present should be true",
    );

    // Log success details
    console.log(`✅ Successfully extracted Quattro product data`);
    console.log(`   Source: ${result._meta.source}`);
    console.log(`   Title: ${result.title}`);
    console.log(
      `   Ingredients length: ${
        result.ingredients_raw?.length || 0
      } characters`,
    );
    console.log(`   Numeric doses present: ${result.numeric_doses_present}`);
  });

  await t.step("should handle extraction failures gracefully", async () => {
    const invalidURL =
      "https://magnumsupps.com/en-us/products/nonexistent-product";

    // Get Supabase configuration from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL environment variable is required");
    }

    const edgeKey = Deno.env.get("SUPABASE_EDGE_FUNCTION_KEY");

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/firecrawl-extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(edgeKey ? { apikey: edgeKey } : {}),
          },
          body: JSON.stringify({ url: invalidURL }),
        },
      );

      const result = await response.json();

      // Should return a structured error response
      assertEquals(typeof result, "object", "Should return an object");
      assertEquals(
        result.title === null || result.title === "",
        true,
        "Should return null/empty title for invalid URL",
      );
    } catch (error) {
      // Error handling is acceptable for invalid URLs
      console.log(
        `Expected error for invalid URL: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  await t.step(
    "should provide debug information on extraction failure",
    async () => {
      const testURL =
        "https://magnumsupps.com/en-us/products/quattro?variant=46056179892527";

      // Get Supabase configuration from environment
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) {
        throw new Error("SUPABASE_URL environment variable is required");
      }

      const edgeKey = Deno.env.get("SUPABASE_EDGE_FUNCTION_KEY");

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/firecrawl-extract`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(edgeKey ? { apikey: edgeKey } : {}),
            },
            body: JSON.stringify({ url: testURL }),
          },
        );

        const result = await response.json();

        // If extraction failed, log debug info
        if (!result.title || !result.ingredients_raw) {
          console.error("❌ Extraction failed - Debug information:");
          console.error(`   Response status: ${response.status}`);
          console.error(`   Result keys: ${Object.keys(result).join(", ")}`);

          // Log first 500 chars of HTML if available
          if (result.html) {
            console.error(
              `   HTML preview: ${result.html.substring(0, 500)}...`,
            );
          }

          if (result.error) {
            console.error(`   Error: ${result.error}`);
          }

          throw new Error("Extraction failed - check debug logs above");
        }
      } catch (error) {
        console.error(
          `❌ Request failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    },
  );
});
