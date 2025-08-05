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
  blend_warning?: boolean;
  total_protein_g?: number | null;
  _meta?: {
    parserSteps?: string[];
    status?: string;
    remediation?: string;
  };
}

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const fetchWithTimeout = (
  url: string,
  init: RequestInit = {},
  ms = 25_000,
): Promise<Response> => {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() =>
    clearTimeout(id)
  );
};

/* ---------------------------------------------------------------------------
 * 5. ultra‑light OCR panel grab
 * -------------------------------------------------------------------------*/
async function lightOCR(
  html: string,
  pageUrl: string,
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  const imgs = [...doc.querySelectorAll("img")];
  if (!imgs.length) return null;

  // Rank images by likelihood of containing supplement panel
  const ranked = imgs
    .map((el, index) => {
      const src = (el.getAttribute("src") || "").toLowerCase();
      const alt = (el.getAttribute("alt") || "").toLowerCase();
      let score = 0;
      if (/supplement|nutrition|facts|ingredients|panel|label|back/.test(src)) score += 3;
      if (/supplement|nutrition|facts|ingredients|panel|label|back/.test(alt)) score += 3;

      // Boost mid‑carousel positions (5‑20) and filenames hinting at panels
      if (index >= 4 && index < 20) score += 1;          // positional boost
      if (/facts|panel|ingredients/.test(src)) score += 2; // filename boost

      return { el, score, index };
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // max 8 images to OCR

  for (const { el } of ranked) {
    let src = el.getAttribute("src") || "";
    if (!src) continue;
    if (src.startsWith("//")) src = `https:${src}`;
    if (src.startsWith("/")) src = new URL(src, pageUrl).href;

    try {
      const fd = new FormData();
      fd.append("url", src);
      fd.append("apikey", apiKey);
      fd.append("language", "eng");
      fd.append("isOverlayRequired", "false");
      fd.append("scale", "true");
      const res = await fetchWithTimeout(
        "https://api.ocr.space/parse/image",
        { method: "POST", body: fd },
        10_000,
      );
      const j = await res.json().catch(() => ({}));
      const text = j?.ParsedResults?.[0]?.ParsedText as string | undefined;
      if (!text) continue;
      const clean = text.trim();
      if (/ingredients?:/i.test(clean) || /supplement\s*facts/i.test(clean)) {
        return clean;
      }
    } catch (_) {
      // ignore OCR errors and continue
    }
  }
  return null;
}

/** Walk DOM including shadow roots */
function* walkDOM(node: any): Generator<any> {
  yield node;
  if (node.shadowRoot) {
    yield* walkDOM(node.shadowRoot);
  }
  for (const child of node.children || []) {
    yield* walkDOM(child);
  }
}

/** Augment existing results with enhanced extraction - NO early returns */
async function augmentFactsAndIngredients(doc: any, html: string, result: ParsedProduct, url: string, env: any): Promise<void> {
  const steps = result._meta?.parserSteps || [];
  
  // Title OG meta fallback
  if (!result.title) {
    const og = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || 
              doc.querySelector('meta[name="title"]')?.getAttribute("content")?.trim();
    if (og) {
      result.title = og;
      steps.push("title-og-meta");
    }
  }
  
  // Only enhance if ingredients_raw is missing or too short
  if (!result.ingredients_raw || result.ingredients_raw.length < 100) {
    // Shopify ingredients selectors
    const shopifySelectors = ['div[data-ingredients]', '#ingredients', 'div.product-ingredients'];
    for (const selector of shopifySelectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent.replace(/\s+/g, ' ').trim();
        if (text.length >= 100) {
          result.ingredients_raw = text;
          steps.push('ingredients-shopify');
          break;
        }
      }
    }
    
    // LD-JSON hasIngredient
    if (!result.ingredients_raw) {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      for (let i = 0; i < scripts.length && !result.ingredients_raw; i++) {
        try {
          const data = JSON.parse(scripts[i].textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item.hasIngredient && Array.isArray(item.hasIngredient)) {
              const ingredients = item.hasIngredient.map((ing: any) => 
                typeof ing === 'string' ? ing : ing.name || ing.text || JSON.stringify(ing)
              ).join(', ');
              const text = `Ingredients: ${ingredients}`.replace(/\s+/g, ' ').trim();
              if (text.length >= 100) {
                result.ingredients_raw = text;
                steps.push('ingredients-ld-json');
                break;
              }
            }
          }
        } catch { continue; }
      }
    }
    
    // Shadow DOM / deep text sweep for ingredients
    if (!result.ingredients_raw) {
      try {
        for (const node of walkDOM(doc.documentElement || doc)) {
          if (node.textContent && /ingredient/i.test(node.textContent)) {
            const text = node.textContent.replace(/\s+/g, ' ').trim();
            if (text.length >= 100) {
              result.ingredients_raw = text;
              steps.push('ingredients-shadow-dom');
              break;
            }
          }
        }
      } catch { /* fallback silently */ }
    }
  }
  
  // Only enhance if supplement_facts is missing or too short
  if (!result.supplement_facts || result.supplement_facts.length < 300) {
    // LD-JSON nutrition
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length && !result.supplement_facts; i++) {
      try {
        const data = JSON.parse(scripts[i].textContent || '');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item.nutrition || item['@type'] === 'NutritionInformation') {
            let nutritionData = JSON.stringify(item.nutrition || item);
            if (nutritionData.length > 1200) nutritionData = nutritionData.substring(0, 1200);
            if (nutritionData.length >= 300) {
              result.supplement_facts = nutritionData;
              steps.push('ld-json-nutrition');
              break;
            }
          }
        }
      } catch { continue; }
    }
    
    // Table/dl normalizer
    if (!result.supplement_facts) {
      const tableSelectors = ['table[class*="supplement"]', 'table[class*="nutrition"]', 'dl[class*="supplement"]', 'dl[class*="nutrition"]'];
      for (const selector of tableSelectors) {
        const element = doc.querySelector(selector);
        if (element) {
          let text = '';
          if (element.tagName === 'TABLE') {
            const rows = element.querySelectorAll('tr');
            const lines: string[] = [];
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td, th');
              const values: string[] = [];
              for (let j = 0; j < cells.length; j++) {
                values.push(cells[j].textContent?.replace(/\s+/g, ' ').trim() || '');
              }
              if (values.length >= 2) lines.push(values.join('\t'));
            }
            text = lines.join('\n');
          } else if (element.tagName === 'DL') {
            const terms = element.querySelectorAll('dt');
            const defs = element.querySelectorAll('dd');
            const lines: string[] = [];
            for (let i = 0; i < Math.min(terms.length, defs.length); i++) {
              const term = terms[i].textContent?.trim() || '';
              const def = defs[i].textContent?.trim() || '';
              if (term && def) lines.push(`${term}\t${def}`);
            }
            text = lines.join('\n');
          }
          if (text.length >= 300) {
            result.supplement_facts = text;
            steps.push(`supplement-facts-table-${selector}`);
            break;
          }
        }
      }
    }
  }
  
  // 2-A MyProtein / GardenOfLife / GNC common div
  if (!result.supplement_facts) {
    const sel = doc.querySelector("div[class*='nutrition'],div.product-nutrition,div.product-nutrition-facts");
    const txt = sel?.textContent?.replace(/\s+/g," ").trim();
    if (txt && txt.length >= 300) {
      result.supplement_facts = txt;
      steps.push("facts-nutrition-div");
    }
  }

  // 2-B MyProtein LD-JSON `.nutrition`
  if (!result.supplement_facts) {
    for (const s of doc.querySelectorAll("script[type='application/ld+json']")) {
      try {
        const o = JSON.parse(s.textContent || "{}");
        if (o.nutrition) {
          const j = JSON.stringify(o.nutrition).slice(0,1200);
          if (j.length >= 300) {
            result.supplement_facts = j;
            steps.push("facts-ldjson-nutrition");
            break;
          }
        }
      } catch (err) { console.warn('[parser json]', err); }
    }
  }

  // Table re-pack: if supplement_facts exists but < 300 chars, try to enhance
  if (result.supplement_facts && result.supplement_facts.length < 300) {
    const allTables = doc.querySelectorAll('table, dl');
    for (let i = 0; i < allTables.length; i++) {
      const element = allTables[i];
      let text = '';
      if (element.tagName === 'TABLE') {
        const rows = element.querySelectorAll('tr');
        const lines: string[] = [];
        for (let j = 0; j < rows.length; j++) {
          const cells = rows[j].querySelectorAll('td, th');
          const values: string[] = [];
          for (let k = 0; k < cells.length; k++) {
            values.push(cells[k].textContent?.replace(/\s+/g, ' ').trim() || '');
          }
          if (values.length >= 2) lines.push(values.join('\t'));
        }
        text = lines.join('\n');
      } else if (element.tagName === 'DL') {
        const terms = element.querySelectorAll('dt');
        const defs = element.querySelectorAll('dd');
        const lines: string[] = [];
        for (let j = 0; j < Math.min(terms.length, defs.length); j++) {
          const term = terms[j].textContent?.trim() || '';
          const def = defs[j].textContent?.trim() || '';
          if (term && def) lines.push(`${term}\t${def}`);
        }
        text = lines.join('\n');
      }
      if (text.length >= 300) {
        result.supplement_facts = text;
        steps.push('table-repack');
        break;
      }
    }
    
    // Shadow DOM / deep text sweep for supplement facts
    if (!result.supplement_facts) {
      try {
        for (const node of walkDOM(doc.documentElement || doc)) {
          if (node.textContent && /nutrition facts|supplement facts/i.test(node.textContent)) {
            const text = node.textContent.replace(/\s+/g, ' ').trim();
            if (text.length >= 300) {
              result.supplement_facts = text;
              steps.push('supplement-facts-shadow-dom');
              break;
            }
          }
        }
      } catch { /* fallback silently */ }
    }
  }
  
  // MyProtein table
  if (!result.supplement_facts) {
    const mp = doc.querySelector("table.nutritionTable, div#nutritional-information");
    const txt = mp?.textContent?.replace(/\s+/g," ").trim();
    if (txt && txt.length >= 300) { result.supplement_facts = txt; steps.push("facts-myprotein-table"); }
  }

  // Garden of Life / GNC common
  if (!result.supplement_facts) {
    const g = doc.querySelector("table#nutrition-facts, table.nutrition-facts-table, div.nutrition-info");
    const txt = g?.textContent?.replace(/\s+/g," ").trim();
    if (txt && txt.length >= 300) { result.supplement_facts = txt; steps.push("facts-gol-gnc-table"); }
  }

  // Huel LD-JSON nutrition
  if (!result.supplement_facts) {
    for (const s of doc.querySelectorAll("script[type='application/ld+json']")) {
      try {
        const o = JSON.parse(s.textContent || "{}");
        if (o?.nutrition) {
          const j = JSON.stringify(o.nutrition).slice(0,1200);
          if (j.length >= 300) { result.supplement_facts = j; steps.push("facts-huel-json"); break; }
        }
      } catch (err) { console.warn('[parser json]', err); }
    }
  }

  // Legendary Foods section
  if (!result.supplement_facts) {
    const lf = doc.querySelector("section#nutrition, div#nutritionFacts")?.textContent;
    if (lf && lf.replace(/\s+/g," ").trim().length >= 300) {
      result.supplement_facts = lf.replace(/\s+/g," ").trim();
      steps.push("facts-legendary-section");
    }
  }

  // Legendary Foods nutrition JSON
  if (!result.supplement_facts) {
    const raw = doc.querySelector("#nutrition-json")?.textContent;
    if (raw) { try { const o = JSON.parse(raw); const j = JSON.stringify(o).slice(0,1200);
      if (j.length >= 300) { result.supplement_facts = j; steps.push("facts-legendary-json"); } } catch (err) { console.warn('[parser json]', err); } }
  }

  // Facts section fallback
  if (!result.supplement_facts || result.supplement_facts.length < 300) {
    const sels = ['section#nutrition', 'section#supplement-facts', 'section[class*="nutrition"]', 'section[class*="supplement-facts"]', 'div#nutrition', 'div#supplement-facts'];
    for (const sel of sels) {
      const el = doc.querySelector(sel);
      if (el) {
        const txt = el.textContent.replace(/\s+/g, ' ').trim();
        if (txt.length >= 300) {
          result.supplement_facts = txt;
          steps.push("facts-section-fallback");
          break;
        }
      }
    }
  }
  
  let tempFacts = result.supplement_facts;
  
  // 200-char nutrition override
  if (result.supplement_facts && result.supplement_facts.length < 300) {
    const t = result.supplement_facts.toLowerCase();
    if (result.supplement_facts.length >= 200 && /(calories|% dv|mg|g)/.test(t)) {
      steps.push("facts-accepted-200");
    } else { result.supplement_facts = null; }
  }
  
  // Relaxed 200-char gate
  if (!result.supplement_facts && tempFacts && tempFacts.length >= 200) {
    const t = tempFacts.toLowerCase();
    const matches = t.match(/(calories|% dv|mg|g|protein|vitamin|mcg|iu|serving size|daily value)/g) || [];
    if (matches.length >= 2) {
      result.supplement_facts = tempFacts;
      steps.push("facts-relaxed-200");
    }
  }

  // 3 - Image-panel OCR fallback (NOW, Huel, Legendary)
  if ((!result.supplement_facts || result.supplement_facts.length < 300) && env?.OCRSPACE_API_KEY) {
    const ocr2 = await lightOCR(html, url, env.OCRSPACE_API_KEY);
    if (ocr2 && ocr2.length >= 300) {
      result.supplement_facts = ocr2;
      steps.push("facts-ocr-panel");
    }
  }
  
  // Assign steps back to result
  if (!result._meta) {
    result._meta = { parserSteps: [] };
  }
  result._meta.parserSteps = steps;
}

/** Extract comprehensive supplement data from HTML and OCR */
export async function parseProductPage(
  html: string,
  url: string,
  ocrText: string | null = null,
  env?: any,
): Promise<ParsedProduct> {
  console.log('[PARSER] Starting supplement extraction');
  
  let title = extractTitle(html);
  
  // Parse with DOM
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  // --- Cellucor / Shopify title fallback ---
  if (!title) {
    const alt = doc.querySelector("h1.product-title, h1.product__title")?.textContent?.trim();
    if (alt) title = alt;
  }
  
  // Extract ingredients
  const ingredients_raw = extractIngredients(doc, ocrText);
  console.log('[PARSER] Ingredients extraction result:', ingredients_raw ? `${ingredients_raw.length} chars` : 'null');
  
  // Extract supplement facts
  const supplement_facts = extractSupplementFacts(doc, ocrText);
  
  // Extract serving info
  const serving_size = extractServingSize(doc, ocrText);
  
  // Extract directions
  const directions = extractDirections(doc, ocrText);
  
  // Extract allergens and warnings
  const allergens = extractAllergens(doc, ocrText);
  const warnings = extractWarnings(doc, ocrText);
  
  // Extract manufacturer
  const manufacturer = extractManufacturer(doc);
  
  // Detect if numeric doses are present
  const numeric_doses_present = detectNumericDoses(ingredients_raw || '', ocrText || '');
  
  // Build result object
  const result: ParsedProduct = {
    title,
    ingredients_raw,
    numeric_doses_present,
    serving_size,
    directions,
    allergens,
    warnings,
    manufacturer: manufacturer || null,
    supplement_facts,
    other_ingredients: null,
    proprietary_blends: [],
    blend_warning: false,
    total_protein_g: null,
    _meta: {
      parserSteps: []
    }
  };
  
  // Augment with enhanced extraction
  await augmentFactsAndIngredients(doc, html, result, url, env);
  
  // --- Generic Shopify fallback parser ---
  await parseShopifyProductPage(doc, result);
  
  // --- Legendary Foods nutrition div ---
  if (!result.supplement_facts) {
    const lf = doc.querySelector("div#nutritionFacts")?.textContent;
    if (lf && lf.replace(/\s+/g, " ").trim().length >= 300) {
      result.supplement_facts = lf.replace(/\s+/g, " ").trim();
      if (!result._meta) result._meta = { parserSteps: [] };
      result._meta.parserSteps = result._meta.parserSteps || [];
      result._meta.parserSteps.push("legendary-nutrition-div");
    }
  }
  
  console.log('[PARSER] Extraction complete');
  
  return result;
}

/** Try multiple selectors and return the first non‑empty product title */
export function extractTitle(html: string): string | null {
  // Optionally slice large HTML
  if (html.length > 100_000) html = html.slice(0, 100_000);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    return null;
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
  
  let title = filtered[0];
  
  if (!title) {
    const alt = doc.querySelector("h1.product-name,h1.product__title,h1.product-heading")?.textContent?.trim();
    if (alt) title = alt;
  }
  
  if (!title) {
    const og = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
    if (og) title = og;
  }
  
  if (!title) {
    const ld = doc.querySelector("script[type='application/ld+json']")?.textContent;
    if (ld) { try { const j = JSON.parse(ld); if (j?.name) title = j.name.trim(); } catch (err) { console.warn('[parser json]', err); } }
  }
  
  return title || null;
}

/** Simple ingredients extraction */
function extractIngredients(doc: any, ocrText: string | null): string | null {
  // Try standard ingredient selectors
  const ingredientSelectors = [
    'div.ingredients', 
    'section#ingredients',
    '.ingredient-list',
    'p, li, div, span, td'
  ];
  
  for (const selector of ingredientSelectors) {
    const elements = doc.querySelectorAll(selector);
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const text = element.textContent || '';
      if (/ingredient/i.test(text) && text.length >= 20) {
        return text.replace(/\s+/g, " ").trim();
      }
    }
  }

  // Body text fallback
  const bodyText = doc.body?.textContent || '';
  const ingredientsMatch = bodyText.match(/ingredients?:\s*([^.]*(?:\.[^.]*){0,3})/i);
  if (ingredientsMatch && ingredientsMatch[1].length >= 20) {
    return `Ingredients: ${ingredientsMatch[1].trim()}`;
  }

  // OCR fallback
  if (ocrText) {
    const ingredientsMatch = ocrText.match(/ingredients?:\s*([^\n]*(?:\n[^\n]+)*)/i);
    if (ingredientsMatch) {
      let ocrIngredients = ingredientsMatch[1].trim();
      if (ocrIngredients.length > 400) {
        ocrIngredients = ocrIngredients.substring(0, 400);
      }
      const blankLineIndex = ocrIngredients.indexOf('\n\n');
      if (blankLineIndex > 0) {
        ocrIngredients = ocrIngredients.substring(0, blankLineIndex);
      }
      return ocrIngredients;
    }
  }

  return null;
}

/** Simple supplement facts extraction */
function extractSupplementFacts(doc: any, ocrText: string | null): string | null {
  // Enhanced OCR fallback first since it usually has the best data
  if (ocrText && (/supplement\s*facts/i.test(ocrText) || /nutrition\s*facts/i.test(ocrText))) {
    const factsMatch = ocrText.match(/(supplement\s*facts|nutrition\s*facts)[\s\S]{0,1200}/i);
    if (factsMatch) {
      return factsMatch[0];
    }
    return ocrText;
  }

  // Try DOM selectors
  const factsSelectors = [
    '.supplement-facts', 
    '.nutrition-facts', 
    'div#nutrition',
    'section#supplement-facts'
  ];
  
  for (const selector of factsSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent && element.textContent.length > 50) {
      return element.textContent.replace(/\s+/g, " ").trim();
    }
  }

  // Body text fallback
  const bodyText = doc.body?.textContent || '';
  const factsMatch = bodyText.match(/((nutrition|supplement) facts[\s\S]{0,1200})/i);
  if (factsMatch) {
    return factsMatch[1];
  }

  return null;
}

/** Extract serving size information */
function extractServingSize(doc: any, ocrText: string | null): string | null {
  // Try DOM first
  const servingSelectors = [
    '[data-serving-size]',
    '.serving-size',
    '.serving'
  ];
  
  for (const selector of servingSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  // Body text search
  const bodyText = doc.body?.textContent || '';
  const servingMatch = bodyText.match(/serving size:\s*([^\n.]+)/i);
  if (servingMatch) {
    return servingMatch[1].trim();
  }

  // OCR fallback
  if (ocrText) {
    const ocrServingMatch = ocrText.match(/serving size:\s*([^\n]+)/i);
    if (ocrServingMatch) {
      return ocrServingMatch[1].trim();
    }
  }

  return null;
}

/** Extract directions */
function extractDirections(doc: any, ocrText: string | null): string | null {
  // Try DOM first
  const directionSelectors = [
    '.directions',
    '#directions',
    '[data-directions]'
  ];
  
  for (const selector of directionSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  // Body text search
  const bodyText = doc.body?.textContent || '';
  const directionsMatch = bodyText.match(/directions:\s*([^.]*(?:\.[^.]*){0,2})/i);
  if (directionsMatch) {
    return directionsMatch[1].trim();
  }

  // OCR fallback
  if (ocrText) {
    const ocrDirectionsMatch = ocrText.match(/directions:\s*([^\n]*(?:\n[^\n]+)*)/i);
    if (ocrDirectionsMatch) {
      return ocrDirectionsMatch[1].trim();
    }
  }

  return null;
}

/** Extract allergens as array */
function extractAllergens(doc: any, ocrText: string | null): string[] {
  const allergens: string[] = [];
  
  // Common allergens to look for
  const commonAllergens = ['milk', 'eggs', 'fish', 'shellfish', 'tree nuts', 'peanuts', 'wheat', 'soybeans', 'soy'];
  
  // Body text search
  const bodyText = doc.body?.textContent || '';
  const allergenMatch = bodyText.match(/allergens?:\s*([^.]+)/i);
  if (allergenMatch) {
    allergens.push(allergenMatch[1].trim());
  }

  // OCR search
  if (ocrText) {
    const ocrAllergenMatch = ocrText.match(/allergens?:\s*([^\n]+)/i);
    if (ocrAllergenMatch) {
      allergens.push(ocrAllergenMatch[1].trim());
    }
  }

  return allergens;
}

/** Extract warnings as array */
function extractWarnings(doc: any, ocrText: string | null): string[] {
  const warnings: string[] = [];
  
  // Body text search
  const bodyText = doc.body?.textContent || '';
  const warningMatch = bodyText.match(/warnings?:\s*([^.]*(?:\.[^.]*){0,2})/i);
  if (warningMatch) {
    warnings.push(warningMatch[1].trim());
  }

  // OCR search
  if (ocrText) {
    const ocrWarningMatch = ocrText.match(/warnings?:\s*([^\n]*(?:\n[^\n]+)*)/i);
    if (ocrWarningMatch) {
      warnings.push(ocrWarningMatch[1].trim());
    }
  }

  return warnings;
}

/** Extract manufacturer */
function extractManufacturer(doc: any): string | null {
  // Try meta tags first
  const brand = doc.querySelector("meta[property='product:brand']")?.getAttribute("content");
  if (brand) return brand;

  // Try structured data
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const data = JSON.parse(scripts[i].textContent || '');
      if (data.brand) {
        return typeof data.brand === 'string' ? data.brand : data.brand.name;
      }
      if (data.manufacturer) {
        return typeof data.manufacturer === 'string' ? data.manufacturer : data.manufacturer.name;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** Detect if numeric doses are present in text */
function detectNumericDoses(ingredientsText: string, ocrText: string): boolean {
  const combined = `${ingredientsText} ${ocrText}`;
  
  // Look for patterns like "500mg", "1g", "2.5 grams", etc.
  const dosePattern = /\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|iu|units?)\b/i;
  return dosePattern.test(combined);
}

/** Generic Shopify fallback parser */
async function parseShopifyProductPage(doc: any, result: ParsedProduct): Promise<void> {
  const steps = result._meta?.parserSteps || [];

  // Detect Shopify via meta generator, Shopify script, or shopify-section CSS class
  const isShopify = !!(
    doc.querySelector('meta[name="generator"][content*="Shopify"]') ||
    [...doc.querySelectorAll('script')].some(script =>
      script.textContent?.includes('window.Shopify')
    ) ||
    doc.querySelector('.shopify-section')
  );
  if (!isShopify) return;

  // Extract title from Shopify selectors
  const titleEl = doc.querySelector('h1.product__title') || doc.querySelector('[data-product-title]');
  if (titleEl?.textContent) {
    result.title = titleEl.textContent.trim();
    steps.push('shopify-title');
  }

  // Extract ingredients from common selectors or via regex fallback
  let ingredientsText = '';
  const ingredientsEl = doc.querySelector('.product-ingredients') || doc.querySelector('[data-ingredients]');
  if (ingredientsEl?.textContent) {
    ingredientsText = ingredientsEl.textContent.replace(/\s+/g, ' ').trim();
  } else {
    const bodyText = doc.body?.textContent || '';
    const match = bodyText.match(/INGREDIENTS:[\s\S]{100,}/i);
    if (match) ingredientsText = match[0];
  }
  if (ingredientsText.length >= 100) {
    result.ingredients_raw = ingredientsText;
    steps.push('shopify-ingredients');
  }

  // Extract supplement facts from elements starting with "SUPPLEMENT FACTS" with relaxed length requirement
  let supplementFactsText = '';
  
  // First try standard supplement facts selectors
  const factsSelectors = ['.supplement-facts', '.nutrition-facts', 'table.supplement-facts'];
  for (const selector of factsSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent && /SUPPLEMENT FACTS/i.test(element.textContent)) {
      supplementFactsText = element.textContent.replace(/\s+/g, ' ').trim();
      break;
    }
  }
  
  // Fallback: scan all div and table elements
  if (!supplementFactsText) {
    const elems = doc.querySelectorAll('div, table');
    for (const el of elems) {
      const text = el.textContent || '';
      if (/SUPPLEMENT FACTS/i.test(text) && text.length >= 200) {
        supplementFactsText = text.replace(/\s+/g, ' ').trim();
        break;
      }
    }
  }
  
  if (supplementFactsText.length >= 200) {
    result.supplement_facts = supplementFactsText;
    steps.push('shopify-supplement-facts');
  }

  // Numeric doses detection heuristic
  const combinedText = `${result.ingredients_raw || ''} ${result.supplement_facts || ''}`;
  result.numeric_doses_present = /\d+\s?(mg|g|mcg|iu)/i.test(combinedText);

  // Append parserStep and set status/remediation if criteria met
  steps.push('shopify_generic');
  if ((result.ingredients_raw?.length ?? 0) >= 100 || (result.supplement_facts?.length ?? 0) >= 300) {
    result._meta!.status = 'success';
    result._meta!.remediation = 'shopify_generic';
  }

  result._meta!.parserSteps = steps;
}

// OCR will be handled by the main function in index.ts
