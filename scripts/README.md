# Live E2E Validation Scripts

## 🎯 live_e2e_check.sh

Comprehensive validation script that tests the deployed `firecrawl-extract` Edge Function against 10 real product pages.

### Prerequisites

Set your Supabase project URL:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
```

### Usage

```bash
./scripts/live_e2e_check.sh
```

### What it tests

**Target URLs (mix of easy & hard labels):**
1. Magnum Quattro (known working)
2. MyProtein Impact Whey 
3. Optimum Nutrition Gold Standard
4. Cellucor C4 Original
5. NOW Foods Omega-3
6. Nature Made Vitamin D3
7. Garden of Life Probiotics
8. GNC Creatine
9. Huel Black Edition
10. Legendary Foods Pastry

### Output

The script generates:
- Real-time progress with ✅/❌ status indicators
- Detailed markdown table with results
- Component success rates (titles, ingredients, supplement facts)
- Failure pattern analysis
- Actionable recommendations

### Sample Output

```
📊 RESULTS SUMMARY
==================

| # | URL | Source | Title | Ingredients | Supp Facts | Notes / Error |
|---|-----|--------|-------|-------------|------------|---------------|
| 1 | magnumsupps.com/en-us/products/quattro | firecrawl | ✅ | ✅ | ✅ | Full extraction success |
| 2 | us.myprotein.com/sports-nutrition/... | scrapfly | ✅ | ❌ | ❌ | HTML returned but parser missed content |

## 📈 EXTRACTION SUMMARY

**Overall Success:** 7 / 10 URLs fully extracted
**Component Success Rates:**
- Titles: 9 / 10 (90%)
- Ingredients: 7 / 10 (70%) 
- Supplement Facts: 6 / 10 (60%)
```

### Troubleshooting

**"No provider returned HTML" errors:**
- Check API keys are configured in Supabase Edge Function environment
- Verify FIRECRAWL_API_KEY, SCRAPFLY_API_KEY, OCRSPACE_API_KEY
- Test with a single known-working URL first

**Network timeouts:**
- The script uses 60-second timeout per request
- Some complex sites may need longer extraction time
- Check provider status pages for outages

**Parser missed content:**
- This indicates HTML was retrieved but content extraction failed
- Consider opening a PR with parser improvements
- Use fixture tests to develop solutions locally first

### Environment Variables

The script only requires:
- `SUPABASE_URL` - Your Supabase project URL

API keys are configured in the Edge Function environment, not locally. 