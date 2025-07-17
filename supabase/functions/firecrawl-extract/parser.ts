// Parser utilities for product extraction
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export interface ParsedProduct {
  title: string | null;
  ingredients_raw: string | null;
  numeric_doses_present: boolean;
  ocr_fallback_log?: string;
  ingredients?: string[];
  allergens?: string[];
  warnings?: string[];
  manufacturer?: string;
  [key: string]: unknown;
}

export async function parseProductPage(html: string, pageUrl?: string): Promise<ParsedProduct> {
  const MAX_HTML_LEN = 400_000;
  if (html.length > MAX_HTML_LEN) html = html.slice(0, MAX_HTML_LEN);
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return {
    title: null,
    ingredients_raw: null,
    numeric_doses_present: false,
  };

  // Title extraction with multi-selector fallback
  let title = null;
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const titleTag = doc.querySelector("title")?.textContent;
  const h1Tag = doc.querySelector("h1")?.textContent;
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content");
  const h2Tag = doc.querySelector("h2")?.textContent;
  title = ogTitle || titleTag || h1Tag || metaDesc || h2Tag || null;

  // Ingredients extraction
  let ingredients = null;
  const ingredientSelectors = [
    "#ProductInfo .rte p",
    "#ProductInfo .rte li",
    ".product-single__description p",
    ".product-single__description li",
  ];
  for (const sel of ingredientSelectors) {
    const node = doc.querySelector(sel);
    if (node && /ingredient/i.test(node.textContent || "")) {
      ingredients = node.textContent;
      break;
    }
  }
  if (!ingredients) {
    const elements = doc.querySelectorAll("p, li, div, span");
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const text = element.textContent || "";
      if (/ingredient/i.test(text)) {
        ingredients = text;
        break;
      }
    }
  }

  // Numeric doses detection
  const numericDoses = ingredients ? /\d+\s?(mg|mcg|g|iu|%|ml)\b/i.test(ingredients) : false;

  return {
    title: title ? title.trim() : null,
    ingredients_raw: ingredients ? ingredients.trim() : null,
    numeric_doses_present: numericDoses,
  };
} 