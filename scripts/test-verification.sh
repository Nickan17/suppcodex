#!/bin/bash

# End-to-End Test Verification Script
# Usage: ./scripts/test-verification.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ALLOWED_HOSTS="localhost,api.openfoodfacts.org,openrouter.ai,api.firecrawl.dev,supabase.co,magnumsupps.com,cdn.shopify.com"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_summary() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  TEST SUMMARY${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Full Suite: $1"
    echo -e "Quattro Integration: $2"
    echo -e "Environment: $3"
    echo -e "Network: $4"
    echo -e "${BLUE}========================================${NC}\n"
}

# Check environment variables
check_env_vars() {
    log "Checking environment variables..."
    
    required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY" "OPENROUTER_API_KEY" "SCRAPFLY_API_KEY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        success "All required environment variables are set"
        return 0
    else
        error "Missing environment variables: ${missing_vars[*]}"
        return 1
    fi
}

# Run full test suite
run_full_suite() {
    print_header "STEP 1: Running Full Test Suite"
    
    log "Executing all unit and integration tests..."
    
    if deno test --allow-env --allow-read --allow-net="$ALLOWED_HOSTS" --no-check 2>&1; then
        success "Full test suite PASSED"
        return 0
    else
        error "Full test suite FAILED"
        return 1
    fi
}

# Run Quattro integration test
run_quattro_test() {
    print_header "STEP 2: Running Quattro Integration Test"
    
    log "Testing Magnum Quattro product extraction..."
    
    if deno test --allow-env --allow-read --allow-net="$ALLOWED_HOSTS" --no-check firecrawl-extract/quattro.integration.test.ts 2>&1; then
        success "Quattro integration test PASSED"
        return 0
    else
        error "Quattro integration test FAILED"
        return 1
    fi
}

# Check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    # Test basic connectivity
    if curl -s --connect-timeout 5 https://api.openfoodfacts.org > /dev/null; then
        success "OpenFoodFacts API accessible"
    else
        warning "OpenFoodFacts API not accessible"
    fi
    
    # Test Supabase connectivity
    if curl -s --connect-timeout 5 https://supabase.co > /dev/null; then
        success "Supabase accessible"
    else
        warning "Supabase not accessible"
    fi
    
    # Test Magnum Supps
    if curl -s --connect-timeout 5 https://magnumsupps.com > /dev/null; then
        success "Magnum Supps accessible"
    else
        warning "Magnum Supps not accessible"
    fi
}

# Main execution
main() {
    print_header "END-TO-END TEST VERIFICATION"
    
    # Change to functions directory
    cd supabase/functions
    
    # Initialize status variables
    full_suite_status="UNKNOWN"
    quattro_status="UNKNOWN"
    env_status="UNKNOWN"
    network_status="UNKNOWN"
    
    # Check environment
    if check_env_vars; then
        env_status="PASS"
    else
        env_status="FAIL"
        warning "Environment check failed - some tests may fail"
    fi
    
    # Check network
    check_network
    network_status="PASS"
    
    # Run full suite
    if run_full_suite; then
        full_suite_status="PASS"
    else
        full_suite_status="FAIL"
    fi
    
    # Run Quattro test
    if run_quattro_test; then
        quattro_status="PASS"
    else
        quattro_status="FAIL"
    fi
    
    # Print summary
    print_summary "$full_suite_status" "$quattro_status" "$env_status" "$network_status"
    
    # Exit with appropriate code
    if [ "$full_suite_status" = "PASS" ] && [ "$quattro_status" = "PASS" ]; then
        success "All tests passed! Ready for GitHub CI."
        exit 0
    else
        error "Some tests failed. Check output above for details."
        exit 1
    fi
}

# Run main function
main "$@" 