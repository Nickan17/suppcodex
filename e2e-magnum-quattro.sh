#!/bin/bash

# E2E Test for Magnum Quattro Supplement

# --- Configuration ---
URL="https://magnumsupps.com/en-us/products/quattro"
ENDPOINT="https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/firecrawl-extract"

# Source environment variables if .env file exists
if [ -f .env ]; then
  echo " sourcing .env file"
  set -a # automatically export all variables
  source .env
  set +a
fi

# Verify that the required secret is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set. Please ensure it is in your .env file or exported."
  exit 1
fi

# The SUPABASE_ANON_KEY is expected to be in the environment variables.

# --- Task 1: POST to edge extract function ---
echo "🧪 Starting E2E test for: $URL"
echo "🚀 POSTing to endpoint: $ENDPOINT"

RESPONSE_FILE="quattro_response.json"
HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  --data-binary @- << DATA
{
  "url": "$URL"
}
DATA
)

echo "✅ Request sent. HTTP Status: $HTTP_STATUS"
echo "📄 Response saved to $RESPONSE_FILE"
echo ""

# --- Validation ---
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "❌ Test Failed: Expected HTTP 200, but got $HTTP_STATUS."
  exit 1
fi

# --- Task 1.5: POST to score function ---
echo "🚀 Scoring extracted data..."
SCORE_ENDPOINT="https://uaqcehoocecvihubnbhp.supabase.co/functions/v1/score-supplement"
SCORED_RESPONSE_FILE="quattro_scored_response.json"

HTTP_STATUS_SCORE=$(curl -s -w "%{http_code}" -o "$SCORED_RESPONSE_FILE" \
  -X POST "$SCORE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d "@$RESPONSE_FILE")

echo "✅ Scoring request sent. HTTP Status: $HTTP_STATUS_SCORE"
echo "📄 Scored response saved to $SCORED_RESPONSE_FILE"
echo ""

if [ "$HTTP_STATUS_SCORE" -ne 200 ]; then
  echo "❌ Test Failed: Scoring step failed with status $HTTP_STATUS_SCORE."
  exit 1
fi

# Use the scored response for validation from now on
RESPONSE_FILE="$SCORED_RESPONSE_FILE"

# --- Task 2 & 3: Parse and Validate Response ---
echo "🔍 Parsing and validating response from merged data..."

# Check for required keys
REQUIRED_KEYS=("title" "ingredients" "supplementFacts" "score" "highlights" "concerns" "_meta")
MISSING_KEYS=()
for key in "${REQUIRED_KEYS[@]}"; do
  if ! jq -e ".$key" "$RESPONSE_FILE" > /dev/null; then
    MISSING_KEYS+=("$key")
  fi
done

if [ ${#MISSING_KEYS[@]} -ne 0 ]; then
  echo "❌ Test Failed: Missing required keys in response: ${MISSING_KEYS[*]}"
  exit 1
fi
echo "✅ All required keys are present."

# Validate supplementFacts.raw
RAW_FACTS=$(jq -r '.supplementFacts.raw' "$RESPONSE_FILE")
NUMERIC_DOSES_PRESENT=$(jq -r '._meta.parser.numeric_doses_present' "$RESPONSE_FILE")

if [ "$NUMERIC_DOSES_PRESENT" == "true" ]; then
  if ! echo "$RAW_FACTS" | grep -qE '[0-9](g|mg|mcg|IU)'; then
    echo "❌ Test Failed: numeric_doses_present is true, but no numeric doses found in supplementFacts.raw."
    exit 1
  fi
  echo "✅ supplementFacts.raw contains numeric doses as expected."
else
  echo "⚠️ supplementFacts.raw does not contain numeric doses, which is consistent with _meta.parser.numeric_doses_present: false."
fi

# Validate ingredients list
INGREDIENTS_LEN=$(jq '.ingredients | length' "$RESPONSE_FILE")
INGREDIENTS_SOURCE=$(jq -r '._meta.ingredients_source' "$RESPONSE_FILE")

if [ "$INGREDIENTS_LEN" -eq 0 ]; then
  echo "⚠️ ingredients[] array is empty. Source: '$INGREDIENTS_SOURCE'. This is expected if ingredients are in an image."
else
  echo "✅ ingredients[] list is populated (length: $INGREDIENTS_LEN)."
fi

# Validate score
SCORE=$(jq '.score' "$RESPONSE_FILE")
if ! [[ "$SCORE" =~ ^[0-9]+$ ]] || [ "$SCORE" -lt 1 ] || [ "$SCORE" -gt 100 ]; then
  echo "❌ Test Failed: Score is not an integer between 1 and 100. Found: $SCORE"
  exit 1
fi
echo "✅ Score is a valid integer: $SCORE."

# Validate _meta.chain
CHAIN_VALID=$(jq -e '._meta.chain | all(.provider and .status and .ms)' "$RESPONSE_FILE")
if [ "$CHAIN_VALID" != "true" ]; then
    echo "❌ Test Failed: _meta.chain is missing or malformed."
    jq '._meta.chain' "$RESPONSE_FILE"
    exit 1
fi
echo "✅ _meta.chain is populated and seems valid."


# --- Task 4: Output Results ---
echo ""
echo "--- Test Results Summary ---"
echo "📊 HTTP Status: $HTTP_STATUS"

RAW_FACTS_SAMPLE=$(echo "$RAW_FACTS" | tr -s '[:space:]' ' ' | cut -c 1-100)
echo "💊 supplementFacts.raw sample: \"$RAW_FACTS_SAMPLE...\""

INGREDIENTS_SAMPLE=$(jq -r '.ingredients[0:2] | join(", ")' "$RESPONSE_FILE")
echo "🌿 ingredients[] length: $INGREDIENTS_LEN. Sample: [$INGREDIENTS_SAMPLE,...]"

HIGHLIGHTS=$(jq -r '.highlights' "$RESPONSE_FILE")
echo "⭐ Score: $SCORE"
echo "✨ Highlights: $HIGHLIGHTS"

CONCERNS=$(jq -r '.concerns' "$RESPONSE_FILE")
echo "⚠️ Concerns: $CONCERNS"

echo "🔗 _meta.chain:"
jq '._meta.chain' "$RESPONSE_FILE"
echo "--------------------------"

echo "🎉 E2E Test Passed!"
exit 0