#!/usr/bin/env bash
set -euo pipefail
SUPABASE_URL="https://uaqcehoocecvihubnbhp.supabase.co"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env}"

curl -i -X POST \
  "$SUPABASE_URL/functions/v1/score-supplement" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Product","ingredients":["Whey Protein","Cocoa"],"supplementFacts":{"raw":"Protein 25g\nCarbs 3g"},"warnings":[]}'