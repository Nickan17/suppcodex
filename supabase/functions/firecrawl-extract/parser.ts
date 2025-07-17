/** Shape returned by parseProductPage() */
export interface ParsedProduct {
  title: string | undefined;
  ingredients_raw?: string;
  numeric_doses_present?: boolean;
}

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

/** Try multiple selectors and return the first non‑empty product title */
export function extractTitle(html: string): string | undefined {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return undefined;
  const candidates = [
    doc.querySelector("meta[property='og:title']")?.getAttribute("content"),
    doc.querySelector("meta[name='title']")?.getAttribute("content"),
    doc.querySelector("title")?.textContent,
    doc.querySelector("h1[itemprop='name']")?.textContent,
    doc.querySelector("h1.product__title")?.textContent,
    doc.querySelector("h1.product-single__title")?.textContent,
    doc.querySelector("meta[name='description']")?.getAttribute("content"),
  ].map((t) => t?.trim()).filter((t) => t);
  return candidates[0];
}

/** Main parser (stripped to title for brevity) */
export async function parseProductPage(
  html: string,
  url: string,
): Promise<ParsedProduct> {
  const title = extractTitle(html);
  return { title };
} 