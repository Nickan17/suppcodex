#!/usr/bin/env bash
set -euo pipefail
SUPABASE_URL="https://uaqcehoocecvihubnbhp.supabase.co"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env}"

curl -s -X POST "$SUPABASE_URL/functions/v1/firecrawl-extract" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://magnumsupps.com/en-us/products/quattro"}' \
| jq '{title, hasMarkdown: ( .raw.data.markdown? | type ),
       mdLen: ( .raw.data.markdown? | tostring | length ),
       htmlLen: ( .raw.data.html? | tostring | length ),
       supplementFacts: ( .supplementFacts?.raw? | type ),
       _meta }'