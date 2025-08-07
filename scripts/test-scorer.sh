#!/usr/bin/env bash
set -euo pipefail
SUPABASE_URL="https://uaqcehoocecvihubnbhp.supabase.co"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in env}"

curl -s -X POST "$SUPABASE_URL/functions/v1/score-supplement" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Whey",
    "ingredients":["Whey Protein Isolate","Cocoa","Sunflower Lecithin"],
    "facts":"Serving Size 35 g — Protein 25 g — Carbs 3 g — Fat 2 g — Calories 150",
    "warnings":["Contains milk; processed in a facility with soy."]
  }'