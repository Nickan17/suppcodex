#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check required environment variable
: "${SUPABASE_URL?Need SUPABASE_URL}"

# Test URL
TEST_URL="https://magnumsupps.com/en-us/products/quattro?variant=46056179892527"

echo -e "${BLUE}Testing Quattro product extraction...${NC}"
echo -e "${BLUE}URL: ${TEST_URL}${NC}"
echo

# Make the API request
response=$(curl -s -X POST "$SUPABASE_URL/functions/v1/firecrawl-extract" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$TEST_URL\"}")

# Check if curl was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Request failed${NC}"
    exit 1
fi

# Pretty print the JSON response
echo -e "${BLUE}Response:${NC}"
echo "$response" | jq .

echo

# Check for ingredients_raw field and print status
if echo "$response" | jq -e '.ingredients_raw' > /dev/null; then
    ingredients_raw=$(echo "$response" | jq -r '.ingredients_raw // empty')
    if [ -n "$ingredients_raw" ]; then
        echo -e "${GREEN}✅ ingredients_raw field is present and non-empty${NC}"
        echo -e "${BLUE}   Length: ${#ingredients_raw} characters${NC}"
        
        # Check for "isolated protein" token
        if echo "$ingredients_raw" | grep -qi "isolated protein"; then
            echo -e "${GREEN}✅ Contains 'isolated protein' token${NC}"
        else
            echo -e "${YELLOW}⚠️  Does not contain 'isolated protein' token${NC}"
        fi
    else
        echo -e "${RED}❌ ingredients_raw field is empty${NC}"
    fi
else
    echo -e "${RED}❌ ingredients_raw field is missing${NC}"
fi

# Check for title field
if echo "$response" | jq -e '.title' > /dev/null; then
    title=$(echo "$response" | jq -r '.title // empty')
    if [ -n "$title" ]; then
        echo -e "${GREEN}✅ title field is present and non-empty${NC}"
        echo -e "${BLUE}   Title: $title${NC}"
        
        # Check for "Quattro" in title
        if echo "$title" | grep -qi "quattro"; then
            echo -e "${GREEN}✅ Title contains 'Quattro'${NC}"
        else
            echo -e "${YELLOW}⚠️  Title does not contain 'Quattro'${NC}"
        fi
    else
        echo -e "${RED}❌ title field is empty${NC}"
    fi
else
    echo -e "${RED}❌ title field is missing${NC}"
fi

# Check for _meta.source field
if echo "$response" | jq -e '._meta.source' > /dev/null; then
    source=$(echo "$response" | jq -r '._meta.source // empty')
    if [ -n "$source" ]; then
        echo -e "${GREEN}✅ _meta.source field is present${NC}"
        echo -e "${BLUE}   Source: $source${NC}"
        
        # Validate source is one of expected values
        case "$source" in
            "firecrawl"|"scrapfly"|"scraperapi")
                echo -e "${GREEN}✅ Source is valid: $source${NC}"
                ;;
            *)
                echo -e "${YELLOW}⚠️  Unexpected source: $source${NC}"
                ;;
        esac
    else
        echo -e "${RED}❌ _meta.source field is empty${NC}"
    fi
else
    echo -e "${RED}❌ _meta.source field is missing${NC}"
fi

# Check for numeric_doses_present field
if echo "$response" | jq -e '.numeric_doses_present' > /dev/null; then
    numeric_doses=$(echo "$response" | jq -r '.numeric_doses_present // false')
    if [ "$numeric_doses" = "true" ]; then
        echo -e "${GREEN}✅ numeric_doses_present is true${NC}"
    else
        echo -e "${YELLOW}⚠️  numeric_doses_present is false${NC}"
    fi
else
    echo -e "${RED}❌ numeric_doses_present field is missing${NC}"
fi

echo
echo -e "${BLUE}Test completed!${NC}" 