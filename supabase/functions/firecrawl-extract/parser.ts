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
    factsSource?: string;
    factsTokens?: number;
    ocrTried?: boolean;
    ocrPicked?: string;
    facts_kind?: string;
    ingredients_source?: string;
    had_numeric_doses?: boolean;
  };
}

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

/** Sanitize string by removing control characters and collapsing whitespace. */
function sanitize(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/\s\s+/g, ' ').trim();
}

/** Sanitize node text by trimming and collapsing whitespace. */
function sanitizeNodeText(el: any): string {
  if (!el?.textContent) return '';
  return el.textContent.replace(/\s+/g, ' ').trim();
}

/** Check if element or its ancestors match exclusion selectors. */
function isExcluded(el: any): boolean {
  if (!el) return false;
  
  const exclusionSelectors = [
    '.reviews', '[id*="review"]', '.jdgm-*', '.yotpo-*', '.stamped-*',
    '.faq', '[id*="faq"]', '[class*="accordion"]'
  ];
  
  let current = el;
  while (current && current.nodeType !== undefined) {
    if (current.nodeType === 1) { // Element node
      const className = current.className || '';
      const id = current.id || '';
      
      // Check class-based exclusions
      if (className.includes('review') || className.includes('faq') || 
          className.includes('jdgm-') || className.includes('yotpo-') || 
          className.includes('stamped-') || className.includes('accordion')) {
        return true;
      }
      
      // Check ID-based exclusions
      if (id.includes('review') || id.includes('faq') || 
          (id.startsWith('shopify-section-') && id.includes('reviews'))) {
        return true;
      }
      
      // Check for review/FAQ content markers
      const text = current.textContent || '';
      if (text.toLowerCase().includes('customer review') || 
          text.toLowerCase().includes('frequently asked') ||
          text.toLowerCase().includes('q&a')) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

/** Count supplement facts tokens in text. */
function tokenScore(s: string): number {
  if (!s) return 0;
  return ((s || '').match(/(serving size|amount per serving|% dv|calories|protein|mg|mcg|iu|supplement\s+facts|nutrition\s+facts)/gi) || []).length;
}

/** Check if parsed content has usable supplement facts. */
function hasUsableContent(parsed: ParsedProduct): boolean {
  const factsLength = parsed.supplement_facts?.length || 0;
  const factsTokens = tokenScore(parsed.supplement_facts || '');
  return factsLength >= 200 && factsTokens >= 2;
}

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
 * 5. Extract ingredients from OCR text
 * -------------------------------------------------------------------------*/

function extractIngredientsFromText(text: string): string | null {
  const m = text.match(
    /ingredients?\s*:\s*([\s\S]{30,600}?)(?:\n\s*\n|allergen|contains|warning|supplement|nutrition|$)/i
  );
  if (!m) return null;
  const block = m[1].replace(/\s+/g, " ").trim();
  return block.length >= 30 ? `Ingredients: ${block}` : null;
}

/* ---------------------------------------------------------------------------
 * 6. Robust OCR panel grab with comprehensive candidate gathering
 * -------------------------------------------------------------------------*/
async function lightOCR(
  html: string,
  pageUrl: string,
  apiKey?: string,
): Promise<{ text: string; factsTokens: number; ingredientsFromOCR?: string } | null> {
  if (!apiKey) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  // Gather comprehensive image candidates
  const candidates: Array<{ url: string; score: number; source: string }> = [];

  // Helper to normalize URLs
  const normalizeUrl = (url: string): string | null => {
    if (!url) return null;
    try {
      if (url.startsWith("//")) url = `https:${url}`;
      if (url.startsWith("/")) url = new URL(url, pageUrl).href;
      return url.startsWith("http") ? url : null;
    } catch {
      return null;
    }
  };

  // Helper to get nearby text context for scoring
  const getNearbyText = (el: any): string => {
    let current = el.parentNode;
    let text = '';
    for (let i = 0; i < 3 && current; i++) {
      if (current.textContent) {
        text += current.textContent;
      }
      current = current.parentNode;
    }
    return text.slice(0, 400); // Limit to ~400 chars
  };

  // Check for Transparent Labs domain-specific nudge
  const isTransparentLabs = pageUrl.includes('transparentlabs.com');
  console.log(`🏷️ ${isTransparentLabs ? 'Transparent Labs detected' : 'Standard domain'} for ${pageUrl}`);

  // 1. Gather from <img> elements with multiple src attributes
  const imgs = [...doc.querySelectorAll("img")];
  imgs.forEach((el, index) => {
    const srcAttrs = ['src', 'data-src', 'data-original', 'data-zoom-image', 'data-rimg-src'];
    
    for (const attr of srcAttrs) {
      const attrValue = el.getAttribute(attr);
      if (!attrValue) continue;
      const url = normalizeUrl(attrValue);
      if (!url) continue;
      
      const alt = (el.getAttribute("alt") || "").toLowerCase();
      const filename = url.toLowerCase();
      const nearbyText = getNearbyText(el).toLowerCase();
      
      let score = 0;
      
      // +4 if filename or alt matches ingredients patterns (higher than supplement facts)
      if (/(ingredients|ingredient)/i.test(filename)) score += 4;
      if (/(ingredients|ingredient)/i.test(alt)) score += 4;
      
      // +3 if filename or alt matches supplement facts patterns
      if (/(supplement|nutrition|facts|label|panel|back)/i.test(filename)) score += 3;
      if (/(supplement|nutrition|facts|label|panel|back)/i.test(alt)) score += 3;
      
      // +2 if nearby text contains "Supplement Facts" or "Ingredients"
      if (nearbyText.includes('supplement facts')) score += 2;
      if (nearbyText.includes('ingredients')) score += 2;
      
      // +5 regex boost: if filename or alt text contains both 'supplement' and 'facts'
      if ((filename.includes('supplement') && filename.includes('facts')) ||
          (alt.includes('supplement') && alt.includes('facts'))) score += 5;
      
      // +1 for size hints or mid-carousel position
      const width = parseInt(el.getAttribute('width') || '0');
      const height = parseInt(el.getAttribute('height') || '0');
      if (width >= 500 || height >= 500) score += 1;
      if (index >= 4 && index < 20) score += 1; // mid-carousel
      
      // Transparent Labs domain-specific nudge: +2 bonus for any supplement-related images
      if (isTransparentLabs && score > 0) {
        score += 2;
        console.log(`🏷️ Transparent Labs bonus applied to ${filename}`);
      }
      
      if (score > 0) {
        candidates.push({ url, score, source: `img[${attr}]` });
      }
    }
  });

  // 2. Gather from <picture><source> elements
  const sources = [...doc.querySelectorAll("picture source")];
  sources.forEach((el) => {
    const srcsets = [el.getAttribute('srcset'), el.getAttribute('data-srcset')]
      .filter(Boolean);
    
    for (const srcset of srcsets) {
      if (!srcset) continue;
      // Parse srcset and get first/best URL
      const urls = srcset.split(',')
        .map(s => s.trim().split(' ')[0])
        .filter(Boolean);
      
      if (urls.length > 0) {
        const url = normalizeUrl(urls[0]);
        if (url) {
          const nearbyText = getNearbyText(el).toLowerCase();
          let score = 1; // Base score for picture sources
          if (nearbyText.includes('supplement facts')) score += 2;
          
          // Transparent Labs domain-specific nudge
          if (isTransparentLabs) score += 1;
          
          candidates.push({ url, score, source: 'picture>source' });
        }
      }
    }
  });

  // 3. Gather from <a href> inside nodes containing "Supplement Facts"
  const links = [...doc.querySelectorAll("a[href]")];
  links.forEach((el) => {
    const href = el.getAttribute('href');
    const nearbyText = getNearbyText(el).toLowerCase();
    
    if (nearbyText.includes('supplement facts') && href) {
      const url = normalizeUrl(href);
      if (url && /\.(jpe?g|png|gif|webp)$/i.test(url)) {
        let score = 2;
        // Transparent Labs domain-specific nudge
        if (isTransparentLabs) score += 1;
        candidates.push({ url, score, source: 'a[href] near facts' });
      }
    }
  });

  // 4. Transparent Labs domain-specific high-priority targeting
  if (isTransparentLabs) {
    // High priority for explicit supplement facts images
    const tlSpecific = [
      ...doc.querySelectorAll('img[alt*="Supplement Facts" i]'),
      // Find figures that contain "Supplement Facts" text and have images
      ...Array.from(doc.querySelectorAll('figure'))
        .filter((fig: any) => fig.textContent?.includes('Supplement Facts'))
        .flatMap((fig: any) => [...fig.querySelectorAll('img')])
    ];
    
    tlSpecific.forEach((el: any) => {
      const url = normalizeUrl(el.getAttribute('src') || el.getAttribute('data-src'));
      if (url) {
        console.log(`🏷️ Transparent Labs high-priority supplement facts image: ${url}`);
        candidates.push({ url, score: 10, source: 'TL supplement facts' }); // Highest priority
      }
    });
  }

  // Sort by score and dedupe
  const uniqueCandidates = Array.from(
    new Map(candidates.map(c => [c.url, c])).values()
  ).sort((a, b) => b.score - a.score).slice(0, 8);

  console.log(`[OCR] Found ${uniqueCandidates.length} image candidates`);

  // Try OCR on each candidate until we find good facts
  for (const { url, score, source } of uniqueCandidates) {
    try {
      console.log(`[OCR] Trying ${source}: ${url.slice(0, 100)}... (score: ${score})`);
      
      const fd = new FormData();
      fd.append("url", url);
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
      
      // Try to extract ingredients from the OCR text
      const ingredientsFromOCR = extractIngredientsFromText(clean);
      
      // Token gate: must match at least 2 supplement facts tokens OR have ingredients
      const factsTokens = (clean.match(/(serving size|calories|% ?dv|mg|g|mcg|iu|vitamin)/gi) || []).length;
      const hasIngredients = ingredientsFromOCR !== null;
      
      if (factsTokens >= 2 || hasIngredients) {
        console.log(`[OCR] ✅ Accepted OCR result with ${factsTokens} tokens, ingredients: ${hasIngredients ? 'yes' : 'no'}`);
        return { text: clean, factsTokens, ingredientsFromOCR: ingredientsFromOCR || undefined };
      } else {
        console.log(`[OCR] ❌ Rejected OCR result with only ${factsTokens} tokens and no ingredients`);
      }
    } catch (error) {
      console.warn(`[OCR] Error processing ${url}:`, error);
      // ignore OCR errors and continue
    }
  }
  
  console.log('[OCR] No suitable supplement facts found in any image');
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
  let ocrResult = null;
  if ((!result.supplement_facts || result.supplement_facts.length < 300 || !result.ingredients_raw) && env?.OCRSPACE_API_KEY) {
    ocrResult = await lightOCR(html, url, env.OCRSPACE_API_KEY);
    if (ocrResult && ocrResult.text) {
      // Set supplement facts if we have enough tokens or if no facts exist
      if (ocrResult.factsTokens >= 2 && (!result.supplement_facts || result.supplement_facts.length < 300)) {
        result.supplement_facts = ocrResult.text;
        steps.push("facts-ocr-panel");
        console.log(`[Parser] ✅ OCR found supplement facts with ${ocrResult.factsTokens} tokens`);
      }
      
      // Set ingredients from OCR if found
      if (ocrResult.ingredientsFromOCR && !result.ingredients_raw) {
        result.ingredients_raw = ocrResult.ingredientsFromOCR;
        steps.push("ingredients-ocr-panel");
        console.log(`[Parser] ✅ OCR found ingredients`);
      }
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
  
  // Add comprehensive telemetry
  if (!result._meta) result._meta = { parserSteps: [] };
  
  // Determine facts source
  let factsSource = 'none';
  let factsTokens = 0;
  let ocrTried = false;
  let ocrPicked = false;
  
  if (result.supplement_facts) {
    factsTokens = tokenScore(result.supplement_facts);
    
    // Determine source based on parser steps
    const steps = result._meta.parserSteps || [];
    if (steps.includes('facts-ocr-panel')) {
      factsSource = 'ocr';
      ocrTried = true;
      ocrPicked = true;
    } else if (steps.includes('facts-ldjson-nutrition')) {
      factsSource = 'ld-json';
    } else if (steps.includes('table-repack')) {
      factsSource = 'table';
    } else if (result.supplement_facts.length > 100) {
      factsSource = 'supplement_facts';
    }
  } else if (env?.OCRSPACE_API_KEY) {
    ocrTried = true;
    ocrPicked = false;
  }
  
  // Determine facts_kind
  let facts_kind = 'ingredients_only';
  if (result.supplement_facts) {
    const factsText = result.supplement_facts.toLowerCase();
    if (/supplement facts/.test(factsText)) {
      facts_kind = 'supplement_facts';
    } else if (/nutrition facts/.test(factsText)) {
      facts_kind = 'nutrition_facts';
    }
  }
  
  // Determine ingredients_source
  let ingredients_source = 'html';
  const steps = result._meta.parserSteps || [];
  if (result.ingredients_raw) {
    if (steps.includes('ingredients-ocr-panel')) {
      ingredients_source = 'ocr_image';
    } else if (steps.includes('ingredients-ld-json')) {
      ingredients_source = 'ldjson';
    } else {
      ingredients_source = 'html';
    }
  }
  
  // Add telemetry to metadata
  result._meta.factsSource = factsSource;
  result._meta.factsTokens = factsTokens;
  result._meta.ocrTried = ocrTried;
  result._meta.ocrPicked = ocrPicked ? 'true' : undefined;
  result._meta.facts_kind = facts_kind;
  result._meta.ingredients_source = ingredients_source;
  result._meta.had_numeric_doses = result.numeric_doses_present;
  
  console.log(`[PARSER] Extraction complete: factsSource=${factsSource}, factsTokens=${factsTokens}, ocrTried=${ocrTried}, facts_kind=${facts_kind}, ingredients_source=${ingredients_source}, numeric_doses=${result.numeric_doses_present}`);
  
  // Sanitize all string fields before returning
  result.title = sanitize(result.title || null);
  result.ingredients_raw = sanitize(result.ingredients_raw);
  result.supplement_facts = sanitize(result.supplement_facts);
  result.serving_size = sanitize(result.serving_size);
  result.directions = sanitize(result.directions);
  result.manufacturer = sanitize(result.manufacturer);
  result.other_ingredients = sanitize(result.other_ingredients);
  if (result.warnings) {
    result.warnings = result.warnings.map(w => sanitize(w)).filter(Boolean) as string[];
  }
  if (result.allergens) {
    result.allergens = result.allergens.map(a => sanitize(a)).filter(Boolean) as string[];
  }
  if (result.proprietary_blends) {
    result.proprietary_blends = result.proprietary_blends.map(b => sanitize(b)).filter(Boolean) as string[];
  }

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
    doc?.querySelector("h1[itemprop='name']")?.textContent,
    doc?.querySelector("h1.product__title")?.textContent,
    doc?.querySelector("h1.product-single__title")?.textContent,
    doc?.querySelector("meta[property='og:title']")?.getAttribute("content"),
    doc?.querySelector("meta[name='title']")?.getAttribute("content"),
    doc?.querySelector("title")?.textContent,
    doc?.querySelector("meta[name='description']")?.getAttribute("content"),
    doc?.querySelectorAll("title")[0]?.textContent,
  ];
  const filtered = candidates
    .map((t) => t?.trim())
    .filter((t) => t)
    .filter((t) => !(/^customer reviews/i.test(t) && t.length > 100)); // Skip titles that start with reviews and are long

  // Fallback: regex for <title>
  if (!filtered.length) {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (m) filtered.push(m[1].trim());
  }
  
  let title = filtered[0];
  
  if (title) {
    const looksLikeReviews = /customer reviews|see all reviews|write a review|most recent|highest rating|lowest rating|pictures|videos|most helpful/i.test(title);
    if (looksLikeReviews || title.length > 120) {
      title = null;
    }
  }
  
  // before other fallbacks:
  const h1Title = doc.querySelector('h1.product__title, h1.product-title, h1.product-single__title')?.textContent?.trim();
  if (!title && h1Title) title = h1Title;
  
  if (!title) {
    const og = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
    if (og) title = og;
  }
  
  if (!title) {
    const ld = doc.querySelector("script[type='application/ld+json']")?.textContent;
    if (ld) { try { const j = JSON.parse(ld); if (j?.name) title = j.name.trim(); } catch (err) { console.warn('[parser json]', err); } }
  }
  
  if (title) {
    // Clean up Customer Reviews pollution
    if (title && /customer reviews/i.test(title)) {
      // Try multiple sources for clean title
      const og = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim();
      const h1 = doc.querySelector("h1.product__title, h1.product-title, h1.product-single__title, h1")?.textContent?.trim();
      const productName = doc.querySelector(".product-single__title, .product__title, .product-title, [data-product-title]")?.textContent?.trim();
      
      // Use the cleanest available source, or fallback to generic supplement name
      const cleanTitle = og || productName || h1;
      if (cleanTitle && !(/customer reviews/i.test(cleanTitle))) {
        title = cleanTitle;
      } else {
        // Last resort: try to extract product name from URL or use generic name
        const urlMatch = url?.match(/\/products\/([^\/\?]+)/);
        const productSlug = urlMatch?.[1]?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        title = productSlug || 'Supplement Product';
      }
    }
    
    // Clean up whitespace, remove control characters, and limit length
    const sanitizedTitle = sanitize(title);
    if (sanitizedTitle && sanitizedTitle.length > 250) {
      title = sanitizedTitle.substring(0, 250).trim() + '...';
    } else {
      title = sanitizedTitle || undefined;
    }
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

  // OCR fallback with improved multi-line pattern
  if (ocrText) {
    const ingredientsMatch = ocrText.match(/ingredients?\s*:\s*([\s\S]{30,600}?)(?:\n\s*\n|allergen|contains|warning|supplement|nutrition|$)/i);
    if (ingredientsMatch) {
      const block = ingredientsMatch[1].replace(/\s+/g, " ").trim();
      return block.length >= 30 ? `Ingredients: ${block}` : null;
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
