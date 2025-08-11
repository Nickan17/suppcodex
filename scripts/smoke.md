# SuppCodex Smoke Guide

Run these before release. Ensure device or simulator has network.

1) Shopify PDP (shopify-json)
- Input a Shopify product URL with clear Ingredients
- Expect: Title Source shows `shopify-json`; ingredients chips render; tokens >= 2 → Quality: Good

2) JS-heavy PDP (Firecrawl/Scrapfly)
- Input a product page that needs JS rendering
- Expect: Title Source shows `firecrawl` or `scrapfly`; telemetry logs on long-press

3) Image-only facts (OCR)
- Input a PDP where text is image-only
- Expect: facts tokens from OCR; Quality shows Partial/Good depending on tokens; ingredients may come from OCR

Cache & Force
- Press “Rescore (force)” → no cache hit logs, network invoked

Title Sanitization
- Ensure no review blob appears in the title; max 80 chars, single line

Telemetry Pill
- Shows: `Source`, `Tokens`, `Serving`, `Partial/Good`. Long-press logs full _meta. 