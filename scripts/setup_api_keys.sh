#!/bin/bash

# 🔑 Supabase Edge Function API Keys Setup
# Configures environment variables for firecrawl-extract function

set -e

echo "🔑 Setting up API keys for firecrawl-extract Edge Function..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    echo "   or visit: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged into Supabase CLI. Please login first:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Supabase CLI detected and authenticated"
echo ""

# Get project reference
echo "📋 Available Supabase projects:"
supabase projects list

echo ""
read -p "Enter your project reference (from the list above): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

echo ""
echo "🔧 Configuring API keys for project: $PROJECT_REF"
echo ""

# Set environment variables using Supabase CLI
echo "Setting FIRECRAWL_API_KEY..."
read -p "Enter Firecrawl API key: " -s FIRECRAWL_KEY
echo ""
supabase secrets set --project-ref "$PROJECT_REF" FIRECRAWL_API_KEY="$FIRECRAWL_KEY"

echo "Setting SCRAPFLY_API_KEY..."
read -p "Enter Scrapfly API key: " -s SCRAPFLY_KEY
echo ""
supabase secrets set --project-ref "$PROJECT_REF" SCRAPFLY_API_KEY="$SCRAPFLY_KEY"

echo "Setting SCRAPERAPI_KEY..."
read -p "Enter ScraperAPI key: " -s SCRAPERAPI_KEY
echo ""
supabase secrets set --project-ref "$PROJECT_REF" SCRAPERAPI_KEY="$SCRAPERAPI_KEY"

echo "Setting OCRSPACE_API_KEY..."
read -p "Enter OCR Space API key: " -s OCRSPACE_KEY
echo ""
supabase secrets set --project-ref "$PROJECT_REF" OCRSPACE_API_KEY="$OCRSPACE_KEY"

echo ""
echo "✅ All API keys configured successfully!"
echo ""
echo "🚀 You can now run the live E2E validation:"
echo "   export SUPABASE_URL=\"https://$PROJECT_REF.supabase.co\""
echo "   ./scripts/live_e2e_check.sh"
echo ""
echo "💡 The Edge Function will be automatically redeployed with new environment variables."
echo "   Wait ~30 seconds before running tests to ensure deployment completes." 