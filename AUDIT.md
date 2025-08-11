## SuppCodex Audit (Expo + Supabase)

### Summary
- Implemented versioned cache keys with force-bypass and explicit logs.
- Wired ScoreScreen to consume normalized subscores with null → “N/A”.
- Bridged UI ingredients from either `ingredients[]` or `ingredients_raw`.
- Added telemetry pill under the ring (title source, tokens, serving, quality), long-press logs `_meta`.
- Edge function hardened: unified facts token counter, thin-content guard, clamped outputs, boolean OCR flags, status codes.
- Secured client env exposure; build-time asserts for required public env vars.
- Removed extraneous hidden routes to silence layout warnings.
- Shared `getGrade(score)` util; ScoreHeader falls back to it when grade not provided.

Remaining risks / follow-ups
- Deno import type errors are expected in app TS context; not part of client build.
- Consider moving ingredient chip builder to a shared util with tests.
- Add CI step to lint edge functions with Deno tooling.

### Data flow (text diagram)
Edge (Shopify JSON → Firecrawl → Scrapfly → OCR) → parser.ts (extractTitle(url), ingredients_raw, supplement_facts, telemetry) → index.ts (looksThin, second-pass, clamp facts/ingredients, status codes, _meta fields incl. requestUrl, titleSource) → client `chainExtractToScore` (cache v4, force) → UI `ScoreScreen` (ScoreHeader, StatChips, Ingredient chips from ingredients[]|ingredients_raw, telemetry pill).

### Acceptance checklist
- ✅ Rescore button bypasses cache (force logs; no cache hit logs)
- ✅ Ingredients render from array or raw string
- ✅ Subscores from normalizedScore; missing → N/A; no zero defaults
- ✅ Telemetry pill renders and long-press dumps meta
- ✅ Edge function status codes and titleSource/requestUrl present; facts/ingredients clamped
- ✅ No public secrets; only EXPO_PUBLIC_* on client; asserts added
- ✅ No layout children warnings
- ✅ Animated warnings: not applicable in current edits; keep useNativeDriver to opacity/transform only 