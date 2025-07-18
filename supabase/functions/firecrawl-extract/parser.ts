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
  blend_warning?: boolean;      // NEW: Warns if proprietary blends hide doses
  total_protein_g?: number | null; // NEW: Extracted protein amount from facts
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
  
  // NEW: Detect proprietary blend warning
  const blend_warning = ingredientsData.proprietary_blends.length > 0;
  
  // NEW: Extract protein amount
  const total_protein_g = extractProteinAmount(supplementFacts, ocrData);
  
  console.log('[PARSER] Final extraction summary:', {
    title: title ? 'found' : 'missing',
    ingredients: ingredientsData.ingredients_raw ? 'found' : 'missing',
    numeric_doses_present,
    serving_size: servingSize ? 'found' : 'missing',
    supplement_facts: supplementFacts ? 'found' : 'missing',
    blend_warning,
    total_protein_g
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
    proprietary_blends: ingredientsData.proprietary_blends,
    blend_warning,
    total_protein_g
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

  // Try DOM first - enhanced extraction for any element with ingredient content
  const elements = doc.querySelectorAll('p, li, div, span, td, section');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const text = element.textContent || '';
    if (/ingredient/i.test(text) && text.length >= 20) {
      result.ingredients_raw = text.trim();
      break;
    }
  }

  // Fallback: look for any text node containing "Ingredients:" and grab block after it
  if (!result.ingredients_raw) {
    const bodyText = doc.body?.textContent || '';
    const ingredientsMatch = bodyText.match(/ingredients?:\s*([^.]*(?:\.[^.]*){0,3})/i);
    if (ingredientsMatch && ingredientsMatch[1].length >= 20) {
      result.ingredients_raw = `Ingredients: ${ingredientsMatch[1].trim()}`;
    }
  }

  // If DOM failed or result too short, try OCR fallback
  if ((!result.ingredients_raw || result.ingredients_raw.length < 50) && ocrText) {
    // Take block after "Ingredients:" up to 400 chars or blank line
    const ingredientsMatch = ocrText.match(/ingredients?:\s*([^\n]*(?:\n[^\n]+)*)/i);
    if (ingredientsMatch) {
      let ocrIngredients = ingredientsMatch[1].trim();
      if (ocrIngredients.length > 400) {
        ocrIngredients = ocrIngredients.substring(0, 400);
      }
      // Stop at blank line
      const blankLineIndex = ocrIngredients.indexOf('\n\n');
      if (blankLineIndex > 0) {
        ocrIngredients = ocrIngredients.substring(0, blankLineIndex);
      }
      if (ocrIngredients.length >= 50) {
        result.ingredients_raw = ocrIngredients;
      }
    }
    
    // Look for other ingredients
    const otherIngredientsMatch = ocrText.match(/other\s*ingredients?:[\s\S]{1,300}?(?=directions|warnings|allergen|$)/i);
    if (otherIngredientsMatch) {
      result.other_ingredients = otherIngredientsMatch[0].trim();
    }
  }

  // Enhanced proprietary blend detection
  if (result.ingredients_raw || ocrText) {
    const searchText = `${result.ingredients_raw || ''} ${ocrText || ''}`;
    const blendMatches = searchText.match(/\b[\w\s]*blend[\s\S]{1,200}?(?=\n|\.|,|$)/gi);
    if (blendMatches) {
      result.proprietary_blends = blendMatches.map(blend => blend.trim());
    }
    
    // Also check for other proprietary indicators
    const proprietaryPatterns = [
      /proprietary\s+blend/gi,
      /exclusive\s+blend/gi,
      /complex.*blend/gi,
      /matrix.*blend/gi
    ];
    
    for (const pattern of proprietaryPatterns) {
      const matches = searchText.match(pattern);
      if (matches) {
        result.proprietary_blends.push(...matches.map(m => m.trim()));
      }
    }
  }

  return result;
}

/** Extract supplement facts panel */
function extractSupplementFacts(doc: any, ocrText: string | null): string | null {
  // If OCR text includes "Supplement Facts" or "Nutrition Facts", return full OCR text (trimmed at 1200 chars)
  if (ocrText && (/supplement\s*facts/i.test(ocrText) || /nutrition\s*facts/i.test(ocrText))) {
    return ocrText.length > 1200 ? ocrText.substring(0, 1200).trim() : ocrText.trim();
  }

  // Try DOM selectors as fallback
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
  const fullText = `${ingredients} ${ocrText}`;
  
  // Use the specified regex pattern for numeric doses
  const numericDosePattern = /\b\d+(\.\d+)?\s?(mg|g|mcg|µg|iu|iu\.|%|calories)\b/i;
  
  return numericDosePattern.test(fullText);
}

/** Extract total protein amount from supplement facts */
function extractProteinAmount(supplementFacts: string | null, ocrText: string | null): number | null {
  const searchText = `${supplementFacts || ''} ${ocrText || ''}`;
  
  // Look for protein line with amount
  const proteinMatches = [
    /protein[^\d]*(\d+)\s*g/i,
    /total\s*protein[^\d]*(\d+)\s*g/i,
    /protein.*?(\d+)\s*g/i,
    /(\d+)\s*g.*protein/i
  ];
  
  for (const pattern of proteinMatches) {
    const match = searchText.match(pattern);
    if (match && match[1]) {
      const amount = parseInt(match[1], 10);
      if (amount > 0 && amount <= 100) { // Reasonable protein range
        return amount;
      }
    }
  }
  
  return null;
}

// OCR will be handled by the main function in index.ts 