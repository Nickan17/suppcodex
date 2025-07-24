#!/bin/bash

# 🎯 Live End-to-End Extraction Validation
# Tests deployed firecrawl-extract Edge Function against real product pages

set -e

# 0️⃣ Prerequisites - Set environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ SUPABASE_URL environment variable not set"
    echo "   Run: export SUPABASE_URL=\"https://your-project.supabase.co\""
    exit 1
fi

EDGE_ENDPOINT="$SUPABASE_URL/functions/v1/firecrawl-extract"
echo "🚀 Testing Edge Function at: $EDGE_ENDPOINT"
echo ""

# 1️⃣ Target URLs (mix of easy & hard labels)
URLS=(
    "https://www.cellucor.com/products/c4-original"
    "https://us.myprotein.com/p/sports-nutrition/impact-whey-isolate/10852482/?variation=10852497"
    "https://cellucor.com/products/c4-original?srsltid=AfmBOoonnNe-KMRLekBUCmzRarV-GgnSiPckUfUuczKdbbCYTKMI62wH"
    "https://www.naturemade.com/products/vitamin-d3-50-mcg-2000-iu-tablets?variant=17920652378183"
    "https://www.gardenoflife.com/vitamin-code-raw-d3?srsltid=AfmBOoq-1-oWxP-k4N7t4ja45S9xGDtmMZXI_sMb9Spdi8IlMb3NxFe3"
    "https://www.nowfoods.com/products/supplements/omega-3-fish-oil-molecularly-distilled-softgels"
    "https://www.gnc.com/vitamin-d/145223.html?srsltid=AfmBOoob30LU8qMz-71aUR1NOAKxBuSt1ThG0X5hZbACRHiyRSEkOcR2"
    "https://huel.com/products/huel-complete-protein"
    "https://us.huel.com/products/huel-complete-protein"
    "https://www.legendaryfoods.com/products/tasty-pastry-blueberry-flavor"
)

# Results arrays
declare -a RESULTS_URL
declare -a RESULTS_SOURCE
declare -a RESULTS_TITLE
declare -a RESULTS_INGREDIENTS
declare -a RESULTS_SUPPFACTS
declare -a RESULTS_BLEND_WARNING
declare -a RESULTS_PROTEIN_G
declare -a RESULTS_NOTES

# Counters
TOTAL_URLS=${#URLS[@]}
SUCCESS_COUNT=0
TITLE_SUCCESS=0
INGREDIENTS_SUCCESS=0
SUPPFACTS_SUCCESS=0
BLOCKED_COUNT=0
TESTED_COUNT=0

echo "📋 Testing $TOTAL_URLS product pages (excluding blocked domains)..."
echo ""

# 2️⃣ Process each URL
for i in "${!URLS[@]}"; do
    URL="${URLS[$i]}"
    NUM=$((i + 1))
    
    echo "[$NUM/$TOTAL_URLS] Testing: $URL"
    
    # Make API call with timeout
    RESPONSE=$(curl -s -m 60 -X POST "$EDGE_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$URL\"}" 2>/dev/null || echo '{"error":"curl_failed"}')
    
    # Check if domain is blocked
    BLOCKED_REASON=$(echo "$RESPONSE" | jq -r '._meta.blockedReason // empty' 2>/dev/null)
    if [ -n "$BLOCKED_REASON" ]; then
        echo "   ⚠️  SKIP (blocked_by_site): $URL"
        BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
        continue
    fi
    
    TESTED_COUNT=$((TESTED_COUNT + 1))
    
    # Parse response
    if echo "$RESPONSE" | jq -e . >/dev/null 2>&1; then
        # Valid JSON response
        ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
        TITLE=$(echo "$RESPONSE" | jq -r '.title // empty')
        INGREDIENTS_RAW=$(echo "$RESPONSE" | jq -r '.ingredients_raw // empty')
        SUPPLEMENT_FACTS=$(echo "$RESPONSE" | jq -r '.supplement_facts // empty')
        BLEND_WARNING=$(echo "$RESPONSE" | jq -r '.blend_warning // false')
        TOTAL_PROTEIN_G=$(echo "$RESPONSE" | jq -r '.total_protein_g // null')
        SOURCE=$(echo "$RESPONSE" | jq -r '._meta.source // "unknown"')
        
        # Analyze results
        TITLE_STATUS="❌"
        INGREDIENTS_STATUS="❌"
        SUPPFACTS_STATUS="❌"
        NOTES=""
        
        if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
            NOTES="API Error: $ERROR"
        else
            # Check title
            if [ -n "$TITLE" ] && [ "$TITLE" != "null" ] && [ "$TITLE" != "" ]; then
                TITLE_STATUS="✅"
                TITLE_SUCCESS=$((TITLE_SUCCESS + 1))
            else
                NOTES="Missing title; "
            fi
            
            # Check ingredients (length > 100)
            if [ -n "$INGREDIENTS_RAW" ] && [ "$INGREDIENTS_RAW" != "null" ] && [ "$INGREDIENTS_RAW" != "" ]; then
                INGREDIENTS_LEN=${#INGREDIENTS_RAW}
                if [ $INGREDIENTS_LEN -gt 100 ]; then
                    INGREDIENTS_STATUS="✅"
                    INGREDIENTS_SUCCESS=$((INGREDIENTS_SUCCESS + 1))
                else
                    NOTES="${NOTES}ingredients too short ($INGREDIENTS_LEN chars); "
                fi
            else
                NOTES="${NOTES}no ingredients found; "
            fi
            
            # Check supplement facts (length > 300)
            if [ -n "$SUPPLEMENT_FACTS" ] && [ "$SUPPLEMENT_FACTS" != "null" ] && [ "$SUPPLEMENT_FACTS" != "" ]; then
                SUPPFACTS_LEN=${#SUPPLEMENT_FACTS}
                if [ $SUPPFACTS_LEN -gt 300 ]; then
                    SUPPFACTS_STATUS="✅"
                    SUPPFACTS_SUCCESS=$((SUPPFACTS_SUCCESS + 1))
                else
                    NOTES="${NOTES}supplement facts too short ($SUPPFACTS_LEN chars); "
                fi
            else
                NOTES="${NOTES}no supplement facts; "
            fi
            
            # Root cause analysis
            if [ "$INGREDIENTS_STATUS" = "❌" ] || [ "$SUPPFACTS_STATUS" = "❌" ]; then
                if [ "$SOURCE" = "none" ]; then
                    NOTES="${NOTES}No provider returned HTML"
                elif [ "$SOURCE" = "scrapfly" ] || [ "$SOURCE" = "firecrawl" ]; then
                    NOTES="${NOTES}HTML returned but parser missed content"
                else
                    NOTES="${NOTES}OCR/carousel extraction failed"
                fi
            fi
            
            # Count full success
            if [ "$TITLE_STATUS" = "✅" ] && [ "$INGREDIENTS_STATUS" = "✅" ] && [ "$SUPPFACTS_STATUS" = "✅" ]; then
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                NOTES="Full extraction success"
            fi
        fi
        
    else
        # Invalid JSON or network error
        TITLE_STATUS="❌"
        INGREDIENTS_STATUS="❌"
        SUPPFACTS_STATUS="❌"
        SOURCE="error"
        NOTES="Network error or invalid response"
    fi
    
    # Store results
    RESULTS_URL[$i]="$URL"
    RESULTS_SOURCE[$i]="$SOURCE"
    RESULTS_TITLE[$i]="$TITLE_STATUS"
    RESULTS_INGREDIENTS[$i]="$INGREDIENTS_STATUS"
    RESULTS_SUPPFACTS[$i]="$SUPPFACTS_STATUS"
    RESULTS_BLEND_WARNING[$i]="$BLEND_WARNING"
    RESULTS_PROTEIN_G[$i]="$TOTAL_PROTEIN_G"
    RESULTS_NOTES[$i]="$NOTES"
    
    echo "   Source: $SOURCE | Title: $TITLE_STATUS | Ingredients: $INGREDIENTS_STATUS | Supp Facts: $SUPPFACTS_STATUS"
    
    # Brief pause between requests
    sleep 1
done

echo ""
echo "📊 RESULTS SUMMARY"
echo "=================="

# 3️⃣ Output markdown table
echo ""
echo "| # | URL | Source | Title | Ingredients | Supp Facts | Blend Warning | Protein g | Notes |"
echo "|---|-----|--------|-------|-------------|------------|---------------|-----------|-------|"

for i in "${!RESULTS_URL[@]}"; do
    NUM=$((i + 1))
    # Truncate URL for display
    SHORT_URL=$(echo "${RESULTS_URL[$i]}" | sed 's/https:\/\///' | cut -c1-40)
    if [ ${#RESULTS_URL[$i]} -gt 40 ]; then
        SHORT_URL="${SHORT_URL}..."
    fi
    
    # Format blend warning and protein for display
    BLEND_DISPLAY="${RESULTS_BLEND_WARNING[$i]}"
    if [ "$BLEND_DISPLAY" = "true" ]; then
        BLEND_DISPLAY="⚠️"
    elif [ "$BLEND_DISPLAY" = "false" ]; then
        BLEND_DISPLAY="✅"
    else
        BLEND_DISPLAY="❓"
    fi
    
    PROTEIN_DISPLAY="${RESULTS_PROTEIN_G[$i]}"
    if [ "$PROTEIN_DISPLAY" = "null" ] || [ "$PROTEIN_DISPLAY" = "" ]; then
        PROTEIN_DISPLAY="❌"
    else
        PROTEIN_DISPLAY="${PROTEIN_DISPLAY}g"
    fi
    
    echo "| $NUM | $SHORT_URL | ${RESULTS_SOURCE[$i]} | ${RESULTS_TITLE[$i]} | ${RESULTS_INGREDIENTS[$i]} | ${RESULTS_SUPPFACTS[$i]} | $BLEND_DISPLAY | $PROTEIN_DISPLAY | ${RESULTS_NOTES[$i]} |"
done

echo ""

# 5️⃣ Summary block
echo "## 📈 EXTRACTION SUMMARY"
echo ""
echo ""
echo "**Blocked-by-site (skipped):** $BLOCKED_COUNT"
echo "**Tested (excluding blocked):** $TESTED_COUNT"
echo ""
echo "**Overall Success:** $SUCCESS_COUNT / $TESTED_COUNT URLs fully extracted"
echo ""
if [ $TESTED_COUNT -gt 0 ]; then
echo "**Component Success Rates:**"
echo "- Titles: $TITLE_SUCCESS / $TESTED_COUNT ($(( TITLE_SUCCESS * 100 / TESTED_COUNT ))%)"
echo "- Ingredients: $INGREDIENTS_SUCCESS / $TESTED_COUNT ($(( INGREDIENTS_SUCCESS * 100 / TESTED_COUNT ))%)"
echo "- Supplement Facts: $SUPPFACTS_SUCCESS / $TESTED_COUNT ($(( SUPPFACTS_SUCCESS * 100 / TESTED_COUNT ))%)"
else
echo "**Component Success Rates:** No URLs were tested (all blocked)"
fi
echo ""

# Analyze failure patterns
echo "**Failure Pattern Analysis:**"
PARSER_FAILURES=0
NETWORK_FAILURES=0
OCR_FAILURES=0

for note in "${RESULTS_NOTES[@]}"; do
    if [[ "$note" == *"parser missed"* ]]; then
        PARSER_FAILURES=$((PARSER_FAILURES + 1))
    elif [[ "$note" == *"Network error"* ]] || [[ "$note" == *"API Error"* ]]; then
        NETWORK_FAILURES=$((NETWORK_FAILURES + 1))
    elif [[ "$note" == *"OCR"* ]] || [[ "$note" == *"carousel"* ]]; then
        OCR_FAILURES=$((OCR_FAILURES + 1))
    fi
done

echo "- Parser/DOM extraction issues: $PARSER_FAILURES"
echo "- Network/API errors: $NETWORK_FAILURES"
echo "- OCR/Image extraction failures: $OCR_FAILURES"
echo ""

# Recommendations
echo "**Next Tweaks Recommended:**"
if [ $PARSER_FAILURES -gt 0 ]; then
    echo "1. 🔧 Enhance DOM selectors for missing ingredient extraction"
fi
if [ $OCR_FAILURES -gt 0 ]; then
    echo "2. 🖼️ Improve image ranking for supplement facts panels"
fi
if [ $SUPPFACTS_SUCCESS -lt $INGREDIENTS_SUCCESS ]; then
    echo "3. 📋 Boost OCR coverage for supplement facts vs basic ingredients"
fi
if [ $TESTED_COUNT -gt 0 ] && [ $SUCCESS_COUNT -lt $(( TESTED_COUNT * 7 / 10 )) ]; then
    echo "4. 🌐 Consider fallback extraction strategies for complex sites"
fi

echo ""
echo "✨ E2E validation complete! Use this data to prioritize parser improvements." 