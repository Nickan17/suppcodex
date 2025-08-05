# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠️ Development Commands

### Frontend (React Native/Expo)
```bash
npm run dev              # Start Expo development server
npm run build:web        # Build web version
npm run lint             # ESLint check
npm test                 # Run Jest tests
npm run test:coverage    # Run tests with coverage
npm run setup            # First-time setup (install + env copy)
```

### Backend (Supabase Edge Functions - Deno)
```bash
cd supabase
deno fmt                 # Format code
deno fmt --check         # Check formatting
deno lint               # Lint code
deno check functions/**/*.ts  # Type check
npm run type-check       # Type check from root
npm run deploy:dev       # Deploy to development
npm run deploy:prod      # Deploy to production
npm run logs            # View function logs
```

### Testing & Validation
```bash
npm run test:pipeline    # Test complete UPC-to-score pipeline
npm run test:health      # Full health check (pipeline + unit tests)
npm run test:all         # Complete test suite (lint + type-check + coverage + pipeline)
./scripts/e2e-test.sh full-pipeline    # End-to-end testing
./scripts/live_e2e_check.sh            # Live API validation
```

## 🏗️ Architecture Overview

### 3-Tier Microservices Architecture
- **Frontend**: React Native/Expo with file-based routing (Expo Router)
- **Backend**: Supabase Edge Functions (Deno/TypeScript)
- **Data**: Supabase database + external APIs (OpenRouter, Firecrawl, etc.)

### Core Pipeline Flow
```
UPC Input → resolve-upc → URL discovery → firecrawl-extract → score-supplement → Final Score
```

### Key Edge Functions
1. **`full-score-from-upc/`** - Main orchestration pipeline
2. **`resolve-upc/`** - UPC to product data resolution (DSLD → FatSecret → OpenFoodFacts)
3. **`firecrawl-extract/`** - Multi-provider web scraping with OCR fallback
4. **`score-supplement/`** - AI-powered scoring using OpenRouter GPT models

## 📁 Critical Files & Patterns

### Configuration Management
- **`supabase/_shared/config.ts`** - Centralized configuration (timeouts, rate limits, scoring weights)
- **`supabase/_shared/env-validation.ts`** - Fail-fast environment validation
- **`supabase/_shared/types.ts`** - Core TypeScript interfaces

### Shared Patterns
- All Edge Functions start with `validateEnvironmentOrThrow()` for environment validation
- Internal function calls use `createInternalHeaders()` with service role authentication
- Web scraping follows provider cascade: Firecrawl → Scrapfly → ScraperAPI → OCR
- All responses include `_meta` objects with remediation guidance

### Frontend Structure
- **`app/_layout.tsx`** - Root layout with theme provider and error boundary
- **`components/ui/`** - Reusable UI components with theme system
- **`lib/supabase.ts`** - Database client with AsyncStorage persistence

## 🔑 Environment Setup

### Required Environment Variables
```bash
# Core Supabase (always required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI & Scraping (required for full functionality)
OPENROUTER_API_KEY=sk-or-v1-...
SCRAPFLY_API_KEY=scp-...

# Optional enhancements
FIRECRAWL_API_KEY=fc_...
OCRSPACE_API_KEY=...
```

### Service Role Key Security
⚠️ **Important**: Service role key must be stored as a Function Secret, not environment variable:
```bash
supabase secrets set EDGE_FUNCTION_SERVICE_ROLE_KEY="your-service-role-key"
```

## 🧪 Testing Strategy

### Unit Tests (Frontend)
- **Framework**: Jest + React Testing Library
- **Location**: `__tests__/` directory
- **Mocking**: Comprehensive mocks for Expo, Supabase, React Native components
- **Run**: `npm test` or `npm run test:coverage`

### Integration Tests (Backend)
- **Framework**: Deno test
- **Location**: `supabase/functions/**/*.test.ts`
- **Coverage**: External API interactions and database operations
- **Run**: `cd supabase && deno test --allow-all functions/**/*.test.ts`

### End-to-End Testing
- **Pipeline Test**: Tests complete UPC-to-score flow with real APIs
- **Live Validation**: Tests deployed functions against 10 real product pages
- **Scripts**: `./scripts/e2e-test.sh` and `./scripts/live_e2e_check.sh`

## 🚨 Common Issues & Solutions

### TypeScript Configuration
- **Issue**: Deno TypeScript compilation errors
- **Solution**: Check `supabase/deno.json` and `supabase/functions/_shared/deno.json`
- **Verify**: `deno check supabase/functions/**/*.ts`

### Environment Validation Failures
- **Issue**: "❌ Environment Validation Failed"
- **Debug**: Check function logs: `supabase functions log <function-name>`
- **Fix**: Verify all required API keys are set in environment

### Web Scraping Failures
- **Issue**: "No provider returned HTML"
- **Debug**: Check individual provider API keys and rate limits
- **Pattern**: Functions automatically cascade through providers: Firecrawl → Scrapfly → ScraperAPI

### Rate Limiting
- **Default**: 5 requests/minute per IP
- **Development**: Increase in `supabase/_shared/config.ts` (temporary only)
- **Production**: Monitor API usage dashboards

## 🔄 Development Workflow

### Local Development
1. **Setup**: `npm run setup` (install deps + copy env template)
2. **Frontend**: `npm run dev` for Expo development
3. **Backend**: Work in `supabase/` directory with Deno commands
4. **Testing**: Use `npm run test:health` for comprehensive validation

### Deployment
1. **Functions**: `npm run deploy:dev` or `npm run deploy:prod`
2. **Verification**: `npm run test:pipeline` to test deployed functions
3. **Monitoring**: `npm run logs` to view function execution

### Code Quality
- **Before commits**: Run `npm run test:all` (lint + type-check + coverage + pipeline)
- **TypeScript**: All functions use strict TypeScript with proper interfaces
- **Error Handling**: Comprehensive error handling with remediation metadata

## 🎯 Architecture Principles

### Resilience
- Multi-provider fallback for web scraping
- Fail-fast environment validation
- Comprehensive error boundaries

### Performance
- Configurable timeouts per service
- Built-in rate limiting
- Content size limits for processing

### Maintainability
- Centralized configuration management
- Strong TypeScript interfaces throughout
- Clear separation of concerns between functions

### Security
- Service role keys stored as Function Secrets
- No sensitive data in logs
- Input validation on all endpoints