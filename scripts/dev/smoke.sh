#!/usr/bin/env bash
set -euo pipefail

# Load environment variables
set -a
if [ -f .env.local ]; then 
  source .env.local
  echo "✓ Loaded .env.local"
elif [ -f .env ]; then 
  source .env
  echo "✓ Loaded .env"
else
  echo "⚠️  No env file found. Create .env.local from .env.example"
  exit 1
fi
set +a

# Verify required variables
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "❌ Missing required environment variables: SUPABASE_URL or SUPABASE_ANON_KEY"
  echo "   Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your env file"
  exit 1
fi

BASE="$SUPABASE_URL/functions/v1"
AUTH="apikey: $SUPABASE_ANON_KEY"

echo "🚀 Running smoke test against: $SUPABASE_URL"

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