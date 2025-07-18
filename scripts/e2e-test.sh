#!/bin/bash

# End-to-End Testing Script for SuppCodex
# Usage: ./scripts/e2e-test.sh [test-type]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_UPC="737628064502"
EXPECTED_SCORE_FIELDS=("overall_score" "ingredient_quality" "transparency" "third_party_testing" "value_for_money")
ALLOWED_HOSTS="localhost,api.openfoodfacts.org,openrouter.ai,api.firecrawl.dev,supabase.co,magnumsupps.com"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Deno
    if ! command -v deno &> /dev/null; then
        error "Deno is not installed. Please install Deno first."
    fi
    success "Deno is installed: $(deno --version | head -n1)"
    
    # Check required environment variables
    required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY" "OPENROUTER_API_KEY" "SCRAPFLY_API_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Environment variable $var is not set"
        fi
    done
    success "All required environment variables are set"
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq for JSON parsing."
    fi
    success "jq is installed"
}

# Static analysis test
test_static_analysis() {
    log "Running static analysis..."
    cd supabase/functions
    
    # Format check
    if deno fmt --check --config _shared/deno.json; then
        success "Code formatting is correct"
    else
        error "Code formatting issues found"
    fi
    
    # Lint check
    if deno lint --config _shared/deno.json; then
        success "Linting passed"
    else
        error "Linting issues found"
    fi
    
    # Type check
    if deno check --config _shared/deno.json **/*.ts; then
        success "Type checking passed"
    else
        error "Type checking issues found"
    fi
    
    cd ../..
}

# Unit tests
test_unit_tests() {
    log "Running unit tests..."
    cd supabase/functions
    
    deno test --allow-env --allow-read --coverage=coverage-unit --config _shared/deno.json \
        --allow-net="$ALLOWED_HOSTS" \
        --filter="^(?!.*Integration).*" \
        **/*.test.ts
    
    deno coverage coverage-unit --lcov --output=coverage-unit.lcov
    success "Unit tests completed with coverage"
    
    cd ../..
}

# Integration tests
test_integration_tests() {
    log "Running integration tests..."
    cd supabase/functions
    
    deno test --allow-env --allow-read --coverage=coverage-integration --config _shared/deno.json \
        --allow-net="$ALLOWED_HOSTS" \
        --filter=".*Integration.*" \
        **/*.test.ts
    
    deno coverage coverage-integration --lcov --output=coverage-integration.lcov
    success "Integration tests completed with coverage"
    
    cd ../..
}

# Deploy verification
test_deploy_verification() {
    log "Verifying deployment..."
    
    # Check if Supabase CLI is available
    if ! command -v supabase &> /dev/null; then
        warning "Supabase CLI not found. Skipping deployment verification."
        return 0
    fi
    
    # Test function endpoints
    functions=("process-upc" "resolve-upc" "score-supplement" "firecrawl-extract" "full-score-from-upc")
    
    for func in "${functions[@]}"; do
        log "Testing $func endpoint..."
        
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            "$SUPABASE_URL/functions/v1/$func" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d '{"test": true}')
        
        if [ "$response" = "400" ] || [ "$response" = "200" ]; then
            success "$func is responding (HTTP $response)"
        else
            error "$func failed (HTTP $response)"
        fi
    done
}

# Live API round-trip test
test_live_api() {
    log "Testing live API round-trip with UPC: $TEST_UPC"
    
    # Test the full pipeline
    response=$(curl -s -X POST \
        "$SUPABASE_URL/functions/v1/full-score-from-upc" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"upc\": \"$TEST_UPC\"}")
    
    log "API Response: $response"
    
    # Validate JSON structure
    if echo "$response" | jq -e '.overall_score' > /dev/null; then
        success "JSON structure is valid"
    else
        error "Invalid JSON structure"
    fi
    
    # Check for required score fields
    for field in "${EXPECTED_SCORE_FIELDS[@]}"; do
        if echo "$response" | jq -e ".$field" > /dev/null; then
            success "Found $field"
        else
            error "Missing $field"
        fi
    done
    
    # Verify database insertion (if RPC function exists)
    log "Verifying database insertion..."
    query_response=$(curl -s -X POST \
        "$SUPABASE_URL/rest/v1/rpc/check_scored_product" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"upc\": \"$TEST_UPC\"}")
    
    if echo "$query_response" | jq -e '.[0]' > /dev/null; then
        success "Product found in database"
    else
        warning "Product not found in database (RPC function may not exist)"
    fi
}

# Fork PR simulation
test_fork_pr_simulation() {
    log "Simulating fork PR environment..."
    
    # Test that we can access test secrets
    if [ -n "$TEST_OPENROUTER_API_KEY" ]; then
        success "Test secrets are available"
    else
        warning "Test secrets not configured"
    fi
    
    # Run tests with test secrets only
    cd supabase/functions
    
    # Temporarily override production secrets with test secrets
    export OPENROUTER_API_KEY="$TEST_OPENROUTER_API_KEY"
    export FIRECRAWL_API_KEY="$TEST_FIRECRAWL_API_KEY"
    
    deno test --allow-env --allow-read --config _shared/deno.json \
        --allow-net="$ALLOWED_HOSTS" \
        --filter="^(?!.*Integration).*" \
        **/*.test.ts
    
    success "Tests passed with test secrets only"
    
    cd ../..
}

# Frontend smoke test
test_frontend_smoke() {
    log "Running frontend smoke tests..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        warning "Node.js not found. Skipping frontend tests."
        return 0
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing frontend dependencies..."
        npm ci
    fi
    
    # Run frontend tests
    npm test -- --testPathPattern="smoke|basic" --passWithNoTests
    
    # Test scan flow API
    log "Testing scan flow API..."
    scan_response=$(curl -s -X POST \
        "$SUPABASE_URL/functions/v1/process-upc" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"upc\": \"$TEST_UPC\"}")
    
    if echo "$scan_response" | jq -e '.' > /dev/null; then
        success "Scan flow API is working"
    else
        error "Scan flow API failed"
    fi
}

# Generate coverage report
generate_coverage_report() {
    log "Generating coverage report..."
    cd supabase/functions
    
    # Merge coverage reports
    if [ -f "coverage-unit.lcov" ] && [ -f "coverage-integration.lcov" ]; then
        cat coverage-unit.lcov coverage-integration.lcov > coverage.lcov
        success "Coverage reports merged"
    elif [ -f "coverage-unit.lcov" ]; then
        cp coverage-unit.lcov coverage.lcov
        success "Unit coverage report generated"
    elif [ -f "coverage-integration.lcov" ]; then
        cp coverage-integration.lcov coverage.lcov
        success "Integration coverage report generated"
    else
        warning "No coverage reports found"
    fi
    
    cd ../..
}

# Main test runner
main() {
    test_type="${1:-full-pipeline}"
    
    log "Starting E2E test: $test_type"
    
    check_prerequisites
    
    case $test_type in
        "static-analysis")
            test_static_analysis
            ;;
        "unit-tests")
            test_unit_tests
            ;;
        "integration-tests")
            test_integration_tests
            ;;
        "deploy-verification")
            test_deploy_verification
            ;;
        "live-api")
            test_live_api
            ;;
        "fork-pr-simulation")
            test_fork_pr_simulation
            ;;
        "frontend-smoke")
            test_frontend_smoke
            ;;
        "full-pipeline")
            test_static_analysis
            test_unit_tests
            test_integration_tests
            test_deploy_verification
            test_live_api
            generate_coverage_report
            ;;
        *)
            error "Unknown test type: $test_type"
            echo "Available test types: static-analysis, unit-tests, integration-tests, deploy-verification, live-api, fork-pr-simulation, frontend-smoke, full-pipeline"
            exit 1
            ;;
    esac
    
    success "E2E test completed: $test_type"
}

# Run main function with all arguments
main "$@" 