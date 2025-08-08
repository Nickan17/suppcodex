#!/usr/bin/env bash
set -euo pipefail

# Required environment variables check
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"

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
: "${SUPABASE_URL:?Set SUPABASE_URL in env file}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env file}"

URL="${1:-https://magnumsupps.com/en-us/products/quattro}"
echo "🚀 Testing extraction for: $URL"

EXTRACT_JSON=$(curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/firecrawl-extract" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$URL\"}")

# Check if extraction has numeric doses
if ! echo "$EXTRACT_JSON" | jq -e '.supplementFacts.raw | test("\\b\\d+\\s*(mg|iu|g|mcg|μg|units?)\\b"; "i")' > /dev/null; then
  echo "❌ No numeric doses found in supplementFacts.raw"
  echo "$EXTRACT_JSON" | jq '.supplementFacts.raw' 
  exit 1
fi

echo "✅ Numeric doses present"

echo "$EXTRACT_JSON" \
  | jq '{title, ingredients, supplementFacts, warnings}' \
  | sed -E "s/[[:cntrl:]]//g" \
  > /tmp/score_input.json

curl -i -X POST \
  "$SUPABASE_URL/functions/v1/score-supplement" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/score_input.json