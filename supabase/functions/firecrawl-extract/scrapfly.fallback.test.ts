import { parseProductPage } from "./parser.ts";
import { assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("scrapfly+ocr fallback - parses magnum quattro html", async () => {
  const html = await Deno.readTextFile("./supabase/functions/firecrawl-extract/fixtures/magnum_quattro.html");
  const parsed = await parseProductPage(html, "https://magnumsupps.com/en-us/products/quattro?variant=46056179892527");
  assertExists(parsed.title, "title should exist");
  assertStringIncludes(parsed.title.toLowerCase(), "magnum");
  assertStringIncludes(parsed.title.toLowerCase(), "quattro");
}); 