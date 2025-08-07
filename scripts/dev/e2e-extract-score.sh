#!/usr/bin/env bash
set -euo pipefail
SUPABASE_URL="https://uaqcehoocecvihubnbhp.supabase.co"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env}"
URL="${1:-https://magnumsupps.com/en-us/products/quattro}"

EXTRACT_JSON=$(curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/firecrawl-extract" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$URL\"}")

echo "$EXTRACT_JSON" \
  | jq '{title, ingredients, supplementFacts, warnings}' \
  | sed -E "s/[[:cntrl:]]//g" \
  > /tmp/score_input.json

curl -i -X POST \
  "$SUPABASE_URL/functions/v1/score-supplement" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/score_input.json