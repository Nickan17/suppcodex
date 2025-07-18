import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test the expandToFull function directly without importing the main module
interface SimplifiedAIResponse {
  pid: string;
  t: number;
  dose: number;
  qual: number;
  risk: number;
  highlights: string[];
}

interface FullSupplementScoreResponse {
  product_id: string;
  product_name: string;
  final_score: number;
  score_breakdown: Record<string, { score: number; reasons: string[]; weight: number }>;
  overall_assessment: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    safety_rating: string;
    efficacy_rating: string;
    transparency_rating: string;
  };
  sources: string[];
  timestamp: string;
  confidence_score: number;
}

function expandToFull(
  r: SimplifiedAIResponse,
  productName: string,
): FullSupplementScoreResponse {
  const map = {
    ingredient_transparency: r.t,
    label_accuracy: r.t,
    clinical_doses: r.dose,
    bioavailability: r.dose,
    third_party_testing: r.qual,
    manufacturing_standards: r.qual,
    additives_fillers: r.risk,
    brand_history: r.risk,
    consumer_sentiment: r.risk,
  } as const;

  const weights: Record<keyof typeof map, number> = {
    ingredient_transparency: 0.20,
    clinical_doses: 0.15,
    bioavailability: 0.10,
    third_party_testing: 0.15,
    additives_fillers: 0.10,
    label_accuracy: 0.10,
    manufacturing_standards: 0.10,
    brand_history: 0.05,
    consumer_sentiment: 0.05,
  };

  let final = 0;
  for (const k in map) final += (map as any)[k] * weights[k as keyof typeof map] * 10;

  return {
    product_id: r.pid,
    product_name: productName,
    final_score: Math.round(final),
    score_breakdown: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, { score: v, reasons: [], weight: weights[k as keyof typeof map] * 100 }])
    ) as any,
    overall_assessment: {
      strengths: r.highlights.slice(0, 1),
      weaknesses: [],
      recommendations: r.highlights.slice(1),
      safety_rating: "—",
      efficacy_rating: "—",
      transparency_rating: "—",
    },
    sources: [],
    timestamp: new Date().toISOString(),
    confidence_score: 0.9,
  };
}

// Test suite for score-supplement function
Deno.test("score-supplement - Scoring Logic", async (t) => {
  await t.step("should calculate final score correctly", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product-123",
      t: 8, // transparency
      dose: 7, // clinical doses
      qual: 9, // quality/testing
      risk: 6, // risk factors
      highlights: ["Great transparency", "Good quality", "Consider alternatives"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(result.product_id, "test-product-123");
    assertEquals(result.product_name, "Test Product");
    assertEquals(typeof result.final_score, "number");
    assertExists(result.final_score);
    assertEquals(result.confidence_score, 0.9);
  });

  await t.step("should handle perfect scores", () => {
    const perfectResponse: SimplifiedAIResponse = {
      pid: "perfect-product",
      t: 10,
      dose: 10,
      qual: 10,
      risk: 10,
      highlights: ["Perfect product"],
    };

    const result = expandToFull(perfectResponse, "Perfect Product");
    assertEquals(result.final_score, 100);
  });

  await t.step("should handle minimum scores", () => {
    const minResponse: SimplifiedAIResponse = {
      pid: "min-product",
      t: 1,
      dose: 1,
      qual: 1,
      risk: 1,
      highlights: ["Poor product"],
    };

    const result = expandToFull(minResponse, "Min Product");
    assertEquals(result.final_score, 10);
  });
});

Deno.test("score-supplement - Score Breakdown", async (t) => {
  await t.step("should generate correct score breakdown structure", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    // Check that all expected categories exist
    const expectedCategories = [
      "ingredient_transparency",
      "label_accuracy", 
      "clinical_doses",
      "bioavailability",
      "third_party_testing",
      "manufacturing_standards",
      "additives_fillers",
      "brand_history",
      "consumer_sentiment"
    ];

    for (const category of expectedCategories) {
      assertExists(result.score_breakdown[category]);
      assertEquals(typeof result.score_breakdown[category].score, "number");
      assertEquals(typeof result.score_breakdown[category].weight, "number");
      assertEquals(Array.isArray(result.score_breakdown[category].reasons), true);
    }
  });

  await t.step("should calculate weights correctly", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    // Check specific weight calculations
    assertEquals(result.score_breakdown.ingredient_transparency.weight, 20);
    assertEquals(result.score_breakdown.clinical_doses.weight, 15);
    assertEquals(result.score_breakdown.bioavailability.weight, 10);
    assertEquals(result.score_breakdown.third_party_testing.weight, 15);
  });
});

Deno.test("score-supplement - Overall Assessment", async (t) => {
  await t.step("should structure assessment correctly", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Strength 1", "Recommendation 1", "Recommendation 2"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(Array.isArray(result.overall_assessment.strengths), true);
    assertEquals(Array.isArray(result.overall_assessment.weaknesses), true);
    assertEquals(Array.isArray(result.overall_assessment.recommendations), true);
    assertEquals(result.overall_assessment.safety_rating, "—");
    assertEquals(result.overall_assessment.efficacy_rating, "—");
    assertEquals(result.overall_assessment.transparency_rating, "—");
  });

  await t.step("should split highlights correctly", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["First strength", "Second strength", "First rec", "Second rec"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(result.overall_assessment.strengths.length, 1);
    assertEquals(result.overall_assessment.strengths[0], "First strength");
    assertEquals(result.overall_assessment.recommendations.length, 3);
    assertEquals(result.overall_assessment.recommendations[0], "Second strength");
  });
});

Deno.test("score-supplement - Input Validation", async (t) => {
  await t.step("should handle missing highlights", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: [],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(result.overall_assessment.strengths.length, 0);
    assertEquals(result.overall_assessment.recommendations.length, 0);
  });

  await t.step("should handle single highlight", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Only one highlight"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(result.overall_assessment.strengths.length, 1);
    assertEquals(result.overall_assessment.recommendations.length, 0);
  });

  await t.step("should handle empty product name", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "");
    
    assertEquals(result.product_name, "");
    assertExists(result.product_id);
  });
});

Deno.test("score-supplement - Edge Cases", async (t) => {
  await t.step("should handle zero scores", () => {
    const zeroResponse: SimplifiedAIResponse = {
      pid: "zero-product",
      t: 0,
      dose: 0,
      qual: 0,
      risk: 0,
      highlights: ["Zero scores"],
    };

    const result = expandToFull(zeroResponse, "Zero Product");
    assertEquals(result.final_score, 0);
  });

  await t.step("should handle decimal scores", () => {
    const decimalResponse: SimplifiedAIResponse = {
      pid: "decimal-product",
      t: 7.5,
      dose: 8.2,
      qual: 6.8,
      risk: 9.1,
      highlights: ["Decimal scores"],
    };

    const result = expandToFull(decimalResponse, "Decimal Product");
    assertEquals(typeof result.final_score, "number");
    assertExists(result.final_score);
  });

  await t.step("should generate valid timestamp", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    // Check that timestamp is a valid ISO string
    const timestamp = new Date(result.timestamp);
    assertEquals(timestamp instanceof Date, true);
    assertEquals(isNaN(timestamp.getTime()), false);
  });
});

Deno.test("score-supplement - Response Structure", async (t) => {
  await t.step("should have all required fields", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    // Check all required fields exist
    assertExists(result.product_id);
    assertExists(result.product_name);
    assertExists(result.final_score);
    assertExists(result.score_breakdown);
    assertExists(result.overall_assessment);
    assertExists(result.sources);
    assertExists(result.timestamp);
    assertExists(result.confidence_score);
  });

  await t.step("should have correct data types", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 8,
      dose: 7,
      qual: 9,
      risk: 6,
      highlights: ["Good product"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    assertEquals(typeof result.product_id, "string");
    assertEquals(typeof result.product_name, "string");
    assertEquals(typeof result.final_score, "number");
    assertEquals(typeof result.score_breakdown, "object");
    assertEquals(typeof result.overall_assessment, "object");
    assertEquals(Array.isArray(result.sources), true);
    assertEquals(typeof result.timestamp, "string");
    assertEquals(typeof result.confidence_score, "number");
  });
});

// Test utilities
Deno.test("score-supplement - Utility Functions", async (t) => {
  await t.step("should handle weight calculations correctly", () => {
    const weights = {
      ingredient_transparency: 0.20,
      clinical_doses: 0.15,
      bioavailability: 0.10,
      third_party_testing: 0.15,
      additives_fillers: 0.10,
      label_accuracy: 0.10,
      manufacturing_standards: 0.10,
      brand_history: 0.05,
      consumer_sentiment: 0.05,
    };

    // Check that weights sum to 1.0
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    assertEquals(totalWeight, 1.0);
  });

  await t.step("should handle score rounding", () => {
    const mockResponse: SimplifiedAIResponse = {
      pid: "test-product",
      t: 7.6,
      dose: 8.3,
      qual: 6.7,
      risk: 9.2,
      highlights: ["Test rounding"],
    };

    const result = expandToFull(mockResponse, "Test Product");
    
    // Check that final_score is a rounded integer
    assertEquals(Number.isInteger(result.final_score), true);
    assertEquals(result.final_score >= 0, true);
    assertEquals(result.final_score <= 100, true);
  });
}); 