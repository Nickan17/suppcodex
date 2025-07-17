/**
 * Centralized Configuration Constants
 *
 * All magic numbers, timeouts, and configuration values extracted from the codebase
 * for better maintainability and easier testing.
 */

// API Timeouts (in milliseconds)
export const TIMEOUTS = {
  FETCH_DEFAULT: 25000,
  FIRECRAWL_EXTRACT: 20000,
  FIRECRAWL_CRAWL: 25000,
  SCRAPFLY: 30000,
  SCRAPERAPI: 60000,
  OCR_SPACE: 10000,
  OPENROUTER: 30000,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS_PER_MINUTE: 5,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // Clean up old entries every 5 minutes
} as const;

// Content Processing Limits
export const PROCESSING_LIMITS = {
  MAX_HTML_LENGTH: 400_000,
  MAX_OCR_IMAGES: 12,
  MIN_INGREDIENT_TEXT_LENGTH: 30,
  MAX_INGREDIENT_MATCH_LENGTH: 120,
  SHOPIFY_IMAGE_RESIZE_DEFAULT: 1200,
  SHOPIFY_IMAGE_RESIZE_FALLBACK: 800,
} as const;

// LLM Configuration
export const LLM_CONFIG = {
  MODEL: "gpt-4o-mini",
  TEMPERATURE: 0,
  RESPONSE_FORMAT: { type: "json_object" } as const,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Scoring Weights (used in score-supplement)
export const SCORING_WEIGHTS = {
  ingredient_transparency: 0.20,
  clinical_doses: 0.15,
  bioavailability: 0.10,
  third_party_testing: 0.15,
  additives_fillers: 0.10,
  label_accuracy: 0.10,
  manufacturing_standards: 0.10,
  brand_history: 0.05,
  consumer_sentiment: 0.05,
} as const;

// OCR Configuration
export const OCR_CONFIG = {
  LANGUAGE: "eng",
  IS_OVERLAY_REQUIRED: "false",
  IS_TABLE: "true",
  SCALE: "true",
  OCR_ENGINE: "2", // 1 = Legacy, 2 = New
  MIN_SCORE_THRESHOLD: 2,
} as const;

// Firecrawl Configuration
export const FIRECRAWL_CONFIG = {
  EXTRACT_TIMEOUT: 10000,
  CRAWL_TIMEOUT: 20000,
  DEFAULT_PROXY_MODE: "auto",
  EXTRACTOR_OPTIONS: { mode: "markdown" },
} as const;

// Regex Patterns
export const PATTERNS = {
  INGREDIENT_LIST: /ingredients?\s*:\s*([^<]{30,400})/i,
  NUMERIC_DOSES: /\d+(\.\d+)?\s?(g|mg|mcg|µg|iu|%)\b/i,
  SUPPLEMENT_FACTS:
    /supplement\s*facts|amino\s*acid\s*profile|nutrition\s*facts/i,
  MEDICINAL_INGREDIENTS:
    /medicinal\s*ingredients?|non[- ]?medicinal|ingredients?/i,
  UPC_CLEAN: /\D/g,
  SUPABASE_URL_FORMAT: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
  OPENROUTER_KEY_PREFIX: /^sk-or-/,
  IMAGE_EXTENSIONS: /\.(jpe?g|png|webp)/i,
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// CORS Configuration
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

// Default Error Messages
export const ERROR_MESSAGES = {
  METHOD_NOT_ALLOWED: "Method Not Allowed",
  INVALID_JSON: "Invalid JSON in request body",
  MISSING_URL: "URL is required",
  MISSING_UPC: "UPC is required",
  ENVIRONMENT_VALIDATION_FAILED:
    "Environment validation failed - see logs for details",
  INTERNAL_SERVER_ERROR: "Internal Server Error",
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded. Try again shortly.",
  UPC_NOT_FOUND: "UPC not found",
  NO_CONTENT_EXTRACTED:
    "No content extracted from target URL after trying all methods",
} as const;
