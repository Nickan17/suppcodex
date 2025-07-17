import { extractTitle } from "../parser.ts";
import { assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("extractTitle finds Magnum Quattro in fixture", async () => {
  const html = await Deno.readTextFile(
    "./supabase/functions/firecrawl-extract/fixtures/magnum_quattro.html",
  );
  const title = extractTitle(html);
  assertExists(title);
  assert(title!.toLowerCase().includes("magnum"));
  assert(title!.toLowerCase().includes("quattro"));
}); 