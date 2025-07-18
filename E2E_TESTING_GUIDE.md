# End-to-End Testing Guide

## Overview

This guide covers the complete end-to-end testing strategy for SuppCodex, including automated CI/CD workflows, manual verification procedures, and debugging techniques for each pipeline stage.

## Quick Start

### Automated Testing (GitHub Actions)

```bash
# Trigger specific E2E test via GitHub Actions
# Go to Actions → End-to-End Testing → Run workflow
# Select test type: full-pipeline, deploy-verification, live-api-test, etc.
```

### Manual Testing (Local)

```bash
# Make script executable
chmod +x scripts/e2e-test.sh

# Run full pipeline test
./scripts/e2e-test.sh full-pipeline

# Run specific test type
./scripts/e2e-test.sh live-api
./scripts/e2e-test.sh deploy-verification
./scripts/e2e-test.sh fork-pr-simulation
```

## Test Types & Pipeline Stages

### 1. Static Analysis
**Purpose**: Validate code quality and type safety
**Tools**: `deno fmt`, `deno lint`, `deno check`

**Manual Verification**:
```bash
cd supabase/functions
deno fmt --check --config _shared/deno.json
deno lint --config _shared/deno.json
deno check --config _shared/deno.json **/*.ts
```

**Common Issues & Fixes**:
- **Format errors**: Run `deno fmt` to auto-fix
- **Lint errors**: Check import paths and unused variables
- **Type errors**: Verify TypeScript interfaces and function signatures

### 2. Unit Tests
**Purpose**: Test individual functions without external dependencies
**Coverage**: Core logic, utilities, input validation

**Manual Verification**:
```bash
cd supabase/functions
deno test --allow-env --allow-read --coverage=coverage-unit \
  --allow-net=localhost,api.openfoodfacts.org,openrouter.ai,api.firecrawl.dev,supabase.co \
  --filter="^(?!.*Integration).*" \
  **/*.test.ts
```

**Debugging Unit Tests**:
- **Test failures**: Check mock data and expected values
- **Permission errors**: Verify `--allow-*` flags
- **Import errors**: Check file paths and module resolution

### 3. Integration Tests
**Purpose**: Test external API interactions and database operations
**Coverage**: API calls, data persistence, error handling

**Manual Verification**:
```bash
cd supabase/functions
deno test --allow-env --allow-read --coverage=coverage-integration \
  --allow-net=localhost,api.openfoodfacts.org,openrouter.ai,api.firecrawl.dev,supabase.co \
  --filter=".*Integration.*" \
  **/*.test.ts
```

**Debugging Integration Tests**:
- **API failures**: Check API keys and rate limits
- **Network timeouts**: Verify internet connectivity and API endpoints
- **Database errors**: Check Supabase connection and table permissions

### 4. Deploy Verification
**Purpose**: Ensure Edge Functions deploy successfully and respond to requests
**Tools**: Supabase CLI, curl health checks

**Manual Verification**:
```bash
# Deploy functions
cd supabase
supabase functions deploy --project-ref YOUR_PROJECT_ID

# Health check each function
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-upc" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Debugging Deployment**:
- **CLI errors**: Check `SUPABASE_ACCESS_TOKEN` and project permissions
- **Function failures**: Review function logs in Supabase dashboard
- **Health check failures**: Verify function URLs and authentication

### 5. Live API Round-Trip
**Purpose**: Test complete pipeline with real UPC data
**Coverage**: End-to-end data flow, JSON validation, database insertion

**Manual Verification**:
```bash
# Test with real UPC
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/full-score-from-upc" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"upc": "737628064502"}'

# Verify database insertion
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/check_scored_product" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"upc": "737628064502"}'
```

**Debugging Live API**:
- **Invalid responses**: Check JSON structure and required fields
- **Missing data**: Verify API key quotas and external service status
- **Database issues**: Check RPC function existence and permissions

### 6. Fork PR Simulation
**Purpose**: Verify security model prevents production secret access
**Coverage**: Secret scoping, test environment isolation

**Manual Verification**:
```bash
# Simulate fork PR environment
export OPENROUTER_API_KEY="$TEST_OPENROUTER_API_KEY"
export FIRECRAWL_API_KEY="$TEST_FIRECRAWL_API_KEY"

# Run tests with test secrets only
cd supabase/functions
deno test --allow-env --allow-read \
  --allow-net=localhost,api.openfoodfacts.org,openrouter.ai,api.firecrawl.dev,supabase.co \
  --filter="^(?!.*Integration).*" \
  **/*.test.ts
```

**Debugging Fork PR**:
- **Secret access errors**: Verify test secrets are configured
- **Permission denied**: Check GitHub repository settings
- **Test failures**: Ensure test secrets have sufficient quotas

### 7. Frontend Smoke Test
**Purpose**: Validate frontend-backend integration
**Coverage**: UI components, API integration, scan flow

**Manual Verification**:
```bash
# Run frontend tests
npm test -- --testPathPattern="smoke|basic"

# Test scan flow API
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-upc" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"upc": "737628064502"}'
```

**Debugging Frontend**:
- **Test failures**: Check React Native dependencies and Expo setup
- **API integration**: Verify Supabase client configuration
- **UI issues**: Check component props and state management

## Environment Setup

### Required Environment Variables

```bash
# Production (main branch only)
OPENROUTER_API_KEY=sk-or-v1-...
FIRECRAWL_API_KEY=fc_...
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_DB_PASSWORD=your-db-password

# Test (all branches)
TEST_OPENROUTER_API_KEY=sk-or-v1-... (test account)
TEST_FIRECRAWL_API_KEY=fc_... (test account)
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_ANON_KEY=your-test-anon-key
```

### Local Development Setup

```bash
# Install dependencies
npm install
curl -fsSL https://deno.land/install.sh | sh

# Install Supabase CLI
npm install -g supabase

# Copy environment template
cp env.example .env
# Edit .env with your secrets

# Make test script executable
chmod +x scripts/e2e-test.sh
```

## Debugging by Pipeline Stage

### Static Analysis Failures

**Symptoms**: Format, lint, or type errors
**Debug Steps**:
1. Check Deno version: `deno --version`
2. Verify config file: `supabase/functions/_shared/deno.json`
3. Run individual checks:
   ```bash
   deno fmt --check
   deno lint
   deno check **/*.ts
   ```

**Common Fixes**:
- Run `deno fmt` to auto-fix formatting
- Add missing imports or fix type annotations
- Update Deno to latest version

### Unit Test Failures

**Symptoms**: Test assertions failing, permission errors
**Debug Steps**:
1. Check test file syntax: `deno check **/*.test.ts`
2. Run single test: `deno test --filter="test-name"`
3. Check permissions: `--allow-env --allow-read --allow-net=...`

**Common Fixes**:
- Update mock data to match expected values
- Fix import paths in test files
- Add missing permissions flags

### Integration Test Failures

**Symptoms**: API timeouts, authentication errors, database failures
**Debug Steps**:
1. Verify API keys are set: `echo $OPENROUTER_API_KEY`
2. Test API connectivity: `curl -I https://api.openfoodfacts.org`
3. Check Supabase connection: `supabase status`

**Common Fixes**:
- Rotate expired API keys
- Check API rate limits and quotas
- Verify Supabase project permissions

### Deployment Failures

**Symptoms**: CLI errors, function deployment failures
**Debug Steps**:
1. Check Supabase CLI: `supabase --version`
2. Verify access token: `supabase projects list`
3. Check function logs: Supabase dashboard

**Common Fixes**:
- Update Supabase CLI: `npm install -g supabase@latest`
- Regenerate access token in Supabase dashboard
- Check function code for syntax errors

### Live API Failures

**Symptoms**: Invalid JSON responses, missing data, database errors
**Debug Steps**:
1. Test individual functions: `curl -X POST function-url`
2. Check response structure: `jq '.' response.json`
3. Verify database schema: Supabase table editor

**Common Fixes**:
- Update function error handling
- Check database table permissions
- Verify RPC function exists

### Fork PR Failures

**Symptoms**: Secret access denied, test failures
**Debug Steps**:
1. Check GitHub repository settings
2. Verify test secrets are configured
3. Test locally with test secrets

**Common Fixes**:
- Add test secrets to repository
- Check repository visibility settings
- Update CI workflow conditions

## Monitoring & Alerts

### GitHub Actions Monitoring

```yaml
# Add to workflow for notifications
- name: Notify on failure
  if: failure()
  run: |
    echo "Pipeline failed at stage: ${{ job.status }}"
    # Add your notification logic here
```

### Log Analysis

```bash
# Check function logs
supabase functions logs --project-ref YOUR_PROJECT_ID

# Monitor API usage
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  "https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/get_api_usage"
```

### Health Checks

```bash
# Automated health check script
#!/bin/bash
for func in process-upc resolve-upc score-supplement; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://YOUR_PROJECT_ID.supabase.co/functions/v1/$func" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -d '{"test": true}')
  echo "$func: HTTP $response"
done
```

## Best Practices

### 1. Test Data Management
- Use consistent test UPCs across environments
- Maintain separate test databases
- Rotate test API keys regularly

### 2. Error Handling
- Log detailed error messages for debugging
- Implement graceful degradation
- Add retry logic for transient failures

### 3. Performance Monitoring
- Track API response times
- Monitor database query performance
- Set up alerts for slow operations

### 4. Security
- Never commit secrets to version control
- Use least-privilege API keys
- Regular security audits of test environments

## Troubleshooting Checklist

- [ ] Environment variables are set correctly
- [ ] API keys have sufficient quotas
- [ ] Supabase project is accessible
- [ ] Network connectivity to external APIs
- [ ] Function code compiles without errors
- [ ] Database schema matches expectations
- [ ] Test data is consistent across environments
- [ ] GitHub secrets are configured properly
- [ ] CI/CD workflow permissions are correct
- [ ] Local development environment matches CI

## Support Resources

- **Deno Documentation**: https://deno.land/manual
- **Supabase Documentation**: https://supabase.com/docs
- **GitHub Actions**: https://docs.github.com/en/actions
- **OpenRouter API**: https://openrouter.ai/docs
- **Firecrawl API**: https://firecrawl.dev/docs 