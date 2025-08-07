#!/usr/bin/env bash
set -euo pipefail

# Smoke test for the entire extraction and scoring pipeline.
#
# Usage:
#   ./scripts/e2e-smoke-test.sh <url>
#
# Example:
#   ./scripts/e2e-smoke-test.sh "https://www.transparentlabs.com/products/bulk-pre-workout"

if [ -z "$1" ]; then
  echo "Usage: $0 <url>"
  exit 1
fi

URL="$1"
SUPABASE_URL="https://uaqcehoocecvihubnbhp.supabase.co"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env}"

echo "Running end-to-end smoke test for URL: $URL"

echo "---"
echo "1. Extracting content with firecrawl-extract..."
EXTRACT_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/firecrawl-extract" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$URL\"}")

echo "Extraction response:"
echo "$EXTRACT_RESPONSE" | jq .

# Check if extraction was successful
if echo "$EXTRACT_RESPONSE" | jq -e '.error' > /dev/null; then
  echo "Extraction failed. Aborting."
  exit 1
fi

echo "---"
echo "2. Scoring extracted content with score-supplement..."
SCORE_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/score-supplement" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$EXTRACT_RESPONSE")

echo "Scoring response:"
echo "$SCORE_RESPONSE" | jq .

echo "---"
echo "Smoke test complete."