/** Shape returned by parseProductPage() */
export interface ParsedProduct {
  title: string | null;
  ingredients_raw?: string | null;
  numeric_doses_present?: boolean;
  serving_size?: string | null;
  directions?: string | null;
  allergens?: string[];
  warnings?: string[];
  manufacturer?: string | null;
  supplement_facts?: string | null;
  other_ingredients?: string | null;
  proprietary_blends?: string[];
}

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

/** Try multiple selectors and return the first non‑empty product title */
export function extractTitle(html: string): string | undefined {
  // Optionally slice large HTML
  if (html.length > 100_000) html = html.slice(0, 100_000);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    return undefined;
  }
  const candidates = [
    doc?.querySelector("meta[property='og:title']")?.getAttribute("content"),
    doc?.querySelector("meta[name='title']")?.getAttribute("content"),
    doc?.querySelector("title")?.textContent,
    doc?.querySelector("h1[itemprop='name']")?.textContent,
    doc?.querySelector("h1.product__title")?.textContent,
    doc?.querySelector("h1.product-single__title")?.textContent,
    doc?.querySelector("meta[name='description']")?.getAttribute("content"),
    doc?.querySelectorAll("title")[0]?.textContent,
  ];
  const filtered = candidates.map((t) => t?.trim()).filter((t) => t);

  // Fallback: regex for <title>
  if (!filtered.length) {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (m) filtered.push(m[1].trim());
  }
  
  const title = filtered[0];
  
  // If we got a generic title, try to extract product name from HTML
  if (title && /award\s*winning|magnum\s*nutraceuticals|sports\s*nutrition|supplement/i.test(title) && title.length > 30) {
    // Look for more specific product selectors first
    const productSelectors = [
      'h1.product-title',
      '.product-name', 
      '[data-product-name]',
      '.product h1'
    ];
    
    for (const selector of productSelectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent?.trim()) {
        const productTitle = element.textContent.trim();
        if (productTitle.length > 5 && !productTitle.includes('Award Winning')) {
          return productTitle;
        }
      }
    }
    
    // Manual search for product names in h1/h2 elements
    const headings = doc.querySelectorAll('h1, h2, h3');
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const text = heading.textContent?.trim() || '';
      if (text.length > 5 && text.length < 100 && !text.includes('Award Winning') && !text.includes('Sports Nutrition')) {
        // Look for supplement product patterns
        if (/\b(protein|amino|creatine|pre-workout|bcaa|whey|casein|isolate|mass|gainer|burn|fat|energy)\b/i.test(text)) {
          return text;
        }
      }
    }
  }
  
  return title;
}

/** Extract comprehensive supplement data from HTML and OCR */
export async function parseProductPage(
  html: string,
  url: string,
  ocrText: string | null = null,
): Promise<ParsedProduct> {
  console.log('[PARSER] Starting comprehensive supplement extraction');
  
  const title = extractTitle(html);
  
  // Parse with DOM
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  // OCR text passed from caller (may be null)
  const ocrData = ocrText;
  console.log('[PARSER] OCR extraction result:', ocrData ? `${ocrData.length} chars` : 'null');
  
  // Extract ingredients from multiple sources
  const ingredientsData = extractIngredients(doc, ocrData);
  console.log('[PARSER] Ingredients extraction result:', ingredientsData.ingredients_raw ? `${ingredientsData.ingredients_raw.length} chars` : 'null');
  
  // Extract supplement facts
  const supplementFacts = extractSupplementFacts(doc, ocrData);
  
  // Extract serving info
  const servingSize = extractServingSize(doc, ocrData);
  
  // Extract directions
  const directions = extractDirections(doc, ocrData);
  
  // Extract allergens and warnings
  const allergens = extractAllergens(doc, ocrData);
  const warnings = extractWarnings(doc, ocrData);
  
  // Extract manufacturer
  const manufacturer = extractManufacturer(doc);
  
  // Detect if numeric doses are present
  const numeric_doses_present = detectNumericDoses(ingredientsData.ingredients_raw || '', ocrData || '');
  
  console.log('[PARSER] Final extraction summary:', {
    title: title ? 'found' : 'missing',
    ingredients: ingredientsData.ingredients_raw ? 'found' : 'missing',
    numeric_doses_present,
    serving_size: servingSize ? 'found' : 'missing',
    supplement_facts: supplementFacts ? 'found' : 'missing'
  });

  return {
    title: title || null,
    ingredients_raw: ingredientsData.ingredients_raw || null,
    numeric_doses_present,
    serving_size: servingSize || null,
    directions: directions || null,
    allergens,
    warnings,
    manufacturer: manufacturer || null,
    supplement_facts: supplementFacts || null,
    other_ingredients: ingredientsData.other_ingredients || null,
    proprietary_blends: ingredientsData.proprietary_blends
  };
}

/** Extract ingredients from DOM and OCR with proprietary blend detection */
function extractIngredients(doc: any, ocrText: string | null): {
  ingredients_raw: string | null;
  other_ingredients: string | null;
  proprietary_blends: string[];
} {
  const result = {
    ingredients_raw: null as string | null,
    other_ingredients: null as string | null,
    proprietary_blends: [] as string[]
  };

  // Try DOM selectors first
  const ingredientSelectors = [
    '#ProductInfo .rte p',
    '#ProductInfo .rte li',
    '.product-single__description p',
    '.product-single__description li',
    '.product-description p',
    '.ingredients',
    '[data-ingredients]',
    '.supplement-facts',
    '.nutrition-facts'
  ];

  for (const selector of ingredientSelectors) {
    const elements = doc.querySelectorAll(selector);
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const text = element.textContent || '';
      if (/ingredients?:/i.test(text) && text.length > 20) {
        result.ingredients_raw = text.trim();
        break;
      }
    }
    if (result.ingredients_raw) break;
  }

  // If DOM failed, try OCR
  if (!result.ingredients_raw && ocrText) {
    // Look for supplement facts panel
    const supplementFactsMatch = ocrText.match(/supplement\s*facts[\s\S]{1,1000}?(?=other\s*ingredients|directions|warnings|$)/i);
    if (supplementFactsMatch) {
      result.ingredients_raw = supplementFactsMatch[0].trim();
    } else {
      // Look for ingredients section
      const ingredientsMatch = ocrText.match(/ingredients?:[\s\S]{1,500}?(?=directions|warnings|allergen|$)/i);
      if (ingredientsMatch) {
        result.ingredients_raw = ingredientsMatch[0].trim();
      }
    }
    
    // Look for other ingredients
    const otherIngredientsMatch = ocrText.match(/other\s*ingredients?:[\s\S]{1,300}?(?=directions|warnings|allergen|$)/i);
    if (otherIngredientsMatch) {
      result.other_ingredients = otherIngredientsMatch[0].trim();
    }
  }

  // Detect proprietary blends
  if (result.ingredients_raw) {
    const blendMatches = result.ingredients_raw.match(/\b[\w\s]*blend[\s\S]{1,200}?(?=\n|\.|,|$)/gi);
    if (blendMatches) {
      result.proprietary_blends = blendMatches.map(blend => blend.trim());
    }
  }

  return result;
}

/** Extract supplement facts panel */
function extractSupplementFacts(doc: any, ocrText: string | null): string | null {
  // Try OCR first for supplement facts
  if (ocrText) {
    const factsMatch = ocrText.match(/supplement\s*facts[\s\S]{1,1500}?(?=other\s*ingredients|directions|warnings|$)/i);
    if (factsMatch) {
      return factsMatch[0].trim();
    }
  }

  // Try DOM selectors
  const factsSelectors = ['.supplement-facts', '.nutrition-facts', '[data-supplement-facts]'];
  for (const selector of factsSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return null;
}

/** Extract serving size information */
function extractServingSize(doc: any, ocrText: string | null): string | null {
  // Try OCR first
  if (ocrText) {
    const servingMatch = ocrText.match(/serving\s*size:?\s*([^\n]{1,100})/i);
    if (servingMatch) {
      return servingMatch[1].trim();
    }
  }

  // Try DOM
  const servingSelectors = ['.serving-size', '[data-serving-size]'];
  for (const selector of servingSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return null;
}

/** Extract directions for use */
function extractDirections(doc: any, ocrText: string | null): string | null {
  // Try OCR first
  if (ocrText) {
    const directionsMatch = ocrText.match(/directions?:[\s\S]{1,500}?(?=warnings|allergen|ingredients|$)/i);
    if (directionsMatch) {
      return directionsMatch[0].trim();
    }
  }

  // Try DOM
  const directionSelectors = ['.directions', '.instructions', '[data-directions]'];
  for (const selector of directionSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return null;
}

/** Extract allergen information */
function extractAllergens(doc: any, ocrText: string | null): string[] {
  const allergens: string[] = [];

  // Common allergens to look for
  const commonAllergens = ['milk', 'soy', 'eggs', 'nuts', 'peanuts', 'wheat', 'fish', 'shellfish', 'tree nuts'];

  // Try OCR first
  if (ocrText) {
    const allergenMatch = ocrText.match(/allergen[^:]*:[\s\S]{1,200}?(?=\n|$)/i);
    if (allergenMatch) {
      const allergenText = allergenMatch[0].toLowerCase();
      for (const allergen of commonAllergens) {
        if (allergenText.includes(allergen)) {
          allergens.push(allergen);
        }
      }
    }
  }

  return [...new Set(allergens)]; // Remove duplicates
}

/** Extract warnings */
function extractWarnings(doc: any, ocrText: string | null): string[] {
  const warnings: string[] = [];

  // Try OCR first
  if (ocrText) {
    const warningsMatch = ocrText.match(/warnings?:[\s\S]{1,300}?(?=\n\n|$)/i);
    if (warningsMatch) {
      warnings.push(warningsMatch[0].trim());
    }
  }

  // Try DOM
  const warningSelectors = ['.warnings', '.warning', '[data-warnings]'];
  for (const selector of warningSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      warnings.push(element.textContent.trim());
    }
  }

  return warnings;
}

/** Extract manufacturer information */
function extractManufacturer(doc: any): string | null {
  const manufacturerSelectors = [
    '[data-manufacturer]',
    '.manufacturer',
    '.brand-name',
    'meta[property="product:brand"]'
  ];

  for (const selector of manufacturerSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const content = element.getAttribute('content') || element.textContent;
      if (content?.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

/** Detect if numeric doses are present (not hidden in proprietary blends) */
function detectNumericDoses(ingredients: string, ocrText: string): boolean {
  const combinedText = `${ingredients} ${ocrText}`.toLowerCase();
  
  // Look for explicit dosage patterns
  const dosagePatterns = [
    /\b\d+\s*(mg|mcg|g|iu|ml|oz)\b/gi,
    /\b\d+\.\d+\s*(mg|mcg|g|iu|ml|oz)\b/gi,
    /\b\d+,\d+\s*(mg|mcg|g|iu|ml|oz)\b/gi
  ];

  let dosageCount = 0;
  for (const pattern of dosagePatterns) {
    const matches = combinedText.match(pattern);
    if (matches) {
      dosageCount += matches.length;
    }
  }

  // Check for proprietary blends (which hide doses)
  const proprietaryBlendCount = (combinedText.match(/\b[\w\s]*blend\b/gi) || []).length;
  
  console.log('[PARSER] Dose detection:', {
    dosageCount,
    proprietaryBlendCount,
    hasDoses: dosageCount > 0,
    hasBlends: proprietaryBlendCount > 0
  });

  // Return true if we found explicit doses, false if mostly proprietary blends
  return dosageCount > proprietaryBlendCount;
}

// OCR will be handled by the main function in index.ts 