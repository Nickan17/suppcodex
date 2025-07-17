// Parser utilities for product extraction
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import * as cheerio from "https://deno.land/x/cheerio@1.0.0-rc.12/mod.ts";

/** Try multiple selectors and return the first non‑empty product title */
export function extractTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  const candidates = [
    $("meta[property='og:title']").attr("content"),
    $("meta[name='title']").attr("content"),
    $("title").first().text(),
    $("h1[itemprop='name']").first().text(),
    $("h1.product__title, h1.product-single__title").first().text(),
    $("meta[name='description']").attr("content"),
  ]
    .map((t) => t?.trim())
    .filter((t) => t);
  return candidates[0];
}

/** Main parser (stripped to title for brevity) */
export async function parseProductPage(html: string, url: string) {
  const title = extractTitle(html);
  return { title };
} 