# Secrets Management Strategy

## Overview
This document outlines the secrets management strategy for the SuppCodex CI/CD pipeline, ensuring security while enabling proper testing and deployment.

## Secret Categories

### 1. Production Secrets (Main Branch Only)
These secrets are only available to the main branch and are used for production deployments:

- `OPENROUTER_API_KEY` - Production OpenRouter API key
- `FIRECRAWL_API_KEY` - Production Firecrawl API key  
- `SUPABASE_ACCESS_TOKEN` - Supabase CLI access token
- `SUPABASE_PROJECT_ID` - Production Supabase project ID
- `SUPABASE_DB_PASSWORD` - Production database password

### 2. Test Secrets (All Branches)
These secrets are available to all branches and PRs for testing:

- `TEST_OPENROUTER_API_KEY` - Test OpenRouter API key (limited quota)
- `TEST_FIRECRAWL_API_KEY` - Test Firecrawl API key (limited quota)
- `SUPABASE_URL` - Test Supabase project URL
- `SUPABASE_ANON_KEY` - Test Supabase anonymous key

### 3. Public Secrets (All Branches)
These are safe to expose and used for basic functionality:

- `GITHUB_TOKEN` - GitHub Actions token (auto-provided)

## GitHub Secrets Setup

### Required Secrets for Repository Owners

1. **Production Secrets** (Settings → Secrets and variables → Actions):
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   FIRECRAWL_API_KEY=fc_...
   SUPABASE_ACCESS_TOKEN=sbp_...
   SUPABASE_PROJECT_ID=your-project-id
   SUPABASE_DB_PASSWORD=your-db-password
   ```

2. **Test Secrets**:
   ```
   TEST_OPENROUTER_API_KEY=sk-or-v1-... (test account)
   TEST_FIRECRAWL_API_KEY=fc_... (test account)
   SUPABASE_URL=https://your-test-project.supabase.co
   SUPABASE_ANON_KEY=your-test-anon-key
   ```

### Fork/PR Security

**Critical**: Production secrets are NOT available to forks or PRs from external contributors. This prevents:
- Accidental exposure of production API keys
- Malicious code from accessing production resources
- Unauthorized deployments

## Environment Variable Strategy

### CI Workflow Logic

```yaml
env:
  # Use test secrets for PRs, real secrets for main branch
  OPENROUTER_API_KEY: ${{ github.ref == 'refs/heads/main' && secrets.OPENROUTER_API_KEY || secrets.TEST_OPENROUTER_API_KEY }}
  FIRECRAWL_API_KEY: ${{ github.ref == 'refs/heads/main' && secrets.FIRECRAWL_API_KEY || secrets.TEST_FIRECRAWL_API_KEY }}
```

### Branch-Specific Behavior

| Branch Type | Production Secrets | Test Secrets | Deploy |
|-------------|-------------------|--------------|---------|
| `main` | ✅ Available | ✅ Available | ✅ Enabled |
| `develop` | ❌ Not Available | ✅ Available | ❌ Disabled |
| `feature/*` | ❌ Not Available | ✅ Available | ❌ Disabled |
| Fork PRs | ❌ Not Available | ❌ Not Available | ❌ Disabled |

## Security Best Practices

### 1. Secret Rotation
- Rotate API keys quarterly
- Use separate test accounts with limited quotas
- Monitor API usage for anomalies

### 2. Access Control
- Repository owners only can manage secrets
- Use least-privilege principle for API keys
- Separate test and production environments

### 3. Monitoring
- Set up alerts for API quota usage
- Monitor deployment logs for secret exposure
- Regular security audits of secret usage

### 4. Development Workflow
- Local development uses `.env` files (not committed)
- CI uses GitHub secrets
- Production uses environment-specific secrets

## Troubleshooting

### Common Issues

1. **"Secret not found" errors in PRs**
   - Expected behavior for external PRs
   - Use test secrets for internal PRs
   - Check secret names match exactly

2. **Integration tests failing in PRs**
   - Verify test secrets are configured
   - Check API quotas for test accounts
   - Ensure network permissions are correct

3. **Deployment failing**
   - Verify production secrets are set
   - Check Supabase CLI access token
   - Ensure project ID is correct

### Debugging Commands

```bash
# Check if secrets are available (in CI)
echo "Branch: ${{ github.ref }}"
echo "Event: ${{ github.event_name }}"

# Test secret access (safe way)
if [ -n "${{ secrets.TEST_OPENROUTER_API_KEY }}" ]; then
  echo "Test secrets available"
else
  echo "Test secrets not available"
fi
```

## Migration Guide

### From Single Secret Setup

If you currently have single secrets, migrate to this strategy:

1. Create test accounts for each API service
2. Add test secrets with `TEST_` prefix
3. Update CI workflow to use conditional logic
4. Test with PRs to verify security
5. Monitor for any issues

### Adding New Secrets

1. Determine if secret is production-only or test-safe
2. Add to appropriate category above
3. Update CI workflow environment variables
4. Document in this file
5. Test in PR before merging 