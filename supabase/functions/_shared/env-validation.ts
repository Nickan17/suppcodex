/**
 * Environment Validation Module
 * 
 * Validates all required environment variables at startup and provides
 * meaningful error messages for missing or invalid configurations.
 * This implements fail-fast behavior to catch configuration issues early.
 */

interface EnvironmentConfig {
  // Supabase Configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  
  // External API Keys
  OPENROUTER_API_KEY: string;
  FIRECRAWL_API_KEY?: string; // Optional, has fallbacks
  SCRAPFLY_API_KEY: string;
  SCRAPERAPI_KEY?: string; // Optional fallback
  OCRSPACE_API_KEY?: string; // Optional for OCR functionality
  
  // Data Provider APIs
  DSLD_API_KEY?: string; // Optional, has fallbacks
  FATSECRET_CLIENT_ID?: string; // Optional, has fallbacks  
  FATSECRET_CLIENT_SECRET?: string; // Optional, has fallbacks
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: EnvironmentConfig;
}

/**
 * Validates that required environment variables are present and properly formatted
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required variables that must be present for core functionality
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY',
    'SCRAPFLY_API_KEY'
  ];
  
  // Optional variables that should be present for full functionality
  const optionalVars = [
    'FIRECRAWL_API_KEY',
    'SCRAPERAPI_KEY', 
    'OCRSPACE_API_KEY',
    'DSLD_API_KEY',
    'FATSECRET_CLIENT_ID',
    'FATSECRET_CLIENT_SECRET'
  ];
  
  // Check required variables
  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }
  
  // Check optional variables and warn if missing
  for (const varName of optionalVars) {
    const value = Deno.env.get(varName);
    if (!value || value.trim() === '') {
      warnings.push(`Optional environment variable missing: ${varName} - some functionality may be limited`);
    }
  }
  
  // Validate Supabase URL format
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)) {
    errors.push('SUPABASE_URL must be in format: https://[project-id].supabase.co');
  }
  
  // Validate API key formats (basic checks)
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (openrouterKey && !openrouterKey.startsWith('sk-or-')) {
    warnings.push('OPENROUTER_API_KEY should start with "sk-or-" - please verify this is correct');
  }
  
  // Check for common configuration mistakes
  if (Deno.env.get('SUPABASE_URL') === Deno.env.get('SUPABASE_ANON_KEY')) {
    errors.push('SUPABASE_URL and SUPABASE_ANON_KEY appear to be the same - please check your configuration');
  }
  
  const isValid = errors.length === 0;
  
  if (isValid) {
    const config: EnvironmentConfig = {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY')!,
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      OPENROUTER_API_KEY: Deno.env.get('OPENROUTER_API_KEY')!,
      SCRAPFLY_API_KEY: Deno.env.get('SCRAPFLY_API_KEY')!,
      FIRECRAWL_API_KEY: Deno.env.get('FIRECRAWL_API_KEY'),
      SCRAPERAPI_KEY: Deno.env.get('SCRAPERAPI_KEY'),
      OCRSPACE_API_KEY: Deno.env.get('OCRSPACE_API_KEY'),
      DSLD_API_KEY: Deno.env.get('DSLD_API_KEY'),
      FATSECRET_CLIENT_ID: Deno.env.get('FATSECRET_CLIENT_ID'),
      FATSECRET_CLIENT_SECRET: Deno.env.get('FATSECRET_CLIENT_SECRET'),
    };
    
    return { isValid: true, errors: [], warnings, config };
  }
  
  return { isValid: false, errors, warnings };
}

/**
 * Validates environment and throws detailed error if validation fails
 * Use this for fail-fast behavior at function startup
 */
export function validateEnvironmentOrThrow(): EnvironmentConfig {
  const result = validateEnvironment();
  
  if (!result.isValid) {
    const errorMessage = [
      '❌ Environment Validation Failed:',
      '',
      'Missing required environment variables:',
      ...result.errors.map(error => `  • ${error}`),
      '',
      'Please set these environment variables and restart the function.',
      '',
      'For setup instructions, see: README.md'
    ].join('\n');
    
    console.error(errorMessage);
    throw new Error('Environment validation failed - see logs for details');
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Warnings:');
    result.warnings.forEach(warning => console.warn(`  • ${warning}`));
  }
  
  console.log('✅ Environment validation passed');
  return result.config!;
}

/**
 * Gets the Supabase base URL for internal function calls
 * Uses environment variable instead of hardcoded value
 */
export function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  return url;
}

/**
 * Creates headers for internal Supabase function calls
 * Includes service role authentication if available
 */
export function createInternalHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey) {
    headers["authorization"] = `Bearer ${serviceKey}`;
    headers["apikey"] = serviceKey;
  }
  
  return headers;
}