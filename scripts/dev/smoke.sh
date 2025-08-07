#!/usr/bin/env bash
set -euo pipefail

BASE="https://$SUPABASE_URL/functions/v1"
AUTH="Authorization: Bearer $SUPABASE_ANON_KEY"

test_one () {
  local URL="$1"
  echo "== $URL =="
  curl -sS -X POST "$BASE/firecrawl-extract" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"url\":\"$URL\"}" \
  | jq '{title, ingredients: ( .ingredients|length ), facts_len: ( .supplementFacts.raw|length ), facts_sample: ( .supplementFacts.raw|tostring|.[:180] ), meta: (._meta|{factsSource,factsTokens,chain})}'
  echo ""
}

test_one "https://www.transparentlabs.com/products/bulk-pre-workout"
test_one "https://magnumsupps.com/en-us/products/quattro"