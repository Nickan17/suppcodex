/**
 * Shared Utility Functions
 * 
 * Common utilities used across Edge Functions with proper error handling,
 * memory management, and type safety.
 */

// Inline constants to avoid import issues
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

const HTTP_STATUS = {
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

const RATE_LIMITS = {
  WINDOW_MS: 60 * 1000,
  MAX_REQUESTS_PER_MINUTE: 5,
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

const PATTERNS = {
  UPC_CLEAN: /\D/g,
} as const;

// ===== ERROR HANDLING =====

export interface ErrorResponseMeta {
  source?: string;
  timestamp?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Creates standardized error responses across all functions
 */
export function createErrorResponse(
  message: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  meta: ErrorResponseMeta = {}
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      _meta: {
        source: "error",
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

/**
 * Creates standardized success responses
 */
export function createSuccessResponse(
  data: Record<string, unknown> | unknown[],
  status: number = HTTP_STATUS.OK,
  meta: Record<string, unknown> = {}
): Response {
  const responseData = typeof data === 'object' && data !== null && !Array.isArray(data)
    ? { ...data as Record<string, unknown> }
    : { data };

  return new Response(
    JSON.stringify({
      ...responseData,
      _meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handles CORS preflight requests
 */
export function handleCORS(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: CORS_HEADERS,
    });
  }
  return null;
}

// ===== RATE LIMITING WITH MEMORY MANAGEMENT =====

interface RateLimitEntry {
  count: number;
  lastReset: number;
  lastAccess: number;
}

class RateLimiter {
  private requestCounts = new Map<string, RateLimitEntry>();
  private cleanupTimer?: number;

  constructor() {
    this.startCleanup();
  }

  /**
   * Check if request should be rate limited
   */
  public isRateLimited(clientIp: string): boolean {
    const now = Date.now();
    const entry = this.requestCounts.get(clientIp) || {
      count: 0,
      lastReset: now,
      lastAccess: now,
    };

    // Reset counter if window has passed
    if (now - entry.lastReset > RATE_LIMITS.WINDOW_MS) {
      entry.count = 1;
      entry.lastReset = now;
    } else {
      entry.count++;
    }

    entry.lastAccess = now;
    this.requestCounts.set(clientIp, entry);

    return entry.count > RATE_LIMITS.MAX_REQUESTS_PER_MINUTE;
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - RATE_LIMITS.CLEANUP_INTERVAL_MS;

    for (const [ip, entry] of this.requestCounts.entries()) {
      if (entry.lastAccess < cutoff) {
        this.requestCounts.delete(ip);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, RATE_LIMITS.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup timer (for testing)
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Extract client IP from request
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ===== INPUT VALIDATION =====

/**
 * Validates UPC format
 */
export function validateUPC(upc: unknown): upc is string {
  if (typeof upc !== "string" || !upc.trim()) {
    return false;
  }
  
  const cleaned = upc.replace(PATTERNS.UPC_CLEAN, "");
  return cleaned.length >= 8 && cleaned.length <= 14;
}

/**
 * Validates URL format
 */
export function validateURL(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }
  
  try {
    new URL(url);
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
}

/**
 * Generate UPC variants for API lookups
 */
export function generateUPCVariants(upc: string): string[] {
  const cleaned = upc.replace(PATTERNS.UPC_CLEAN, "");
  const ean13 = cleaned.padStart(13, "0");
  const upc12 = ean13.slice(1); // drop leading 0
  return Array.from(new Set([cleaned, upc12, ean13]));
}

// ===== FETCH UTILITIES =====

/**
 * Fetch with timeout and error handling
 */
export async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout: number = 25000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===== TYPE GUARDS =====

/**
 * Type guard for objects with message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

// ===== LOGGING UTILITIES =====

/**
 * Structured logging with request context
 */
export function logWithContext(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {}
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const logFunction = level === "error" ? console.error : 
                     level === "warn" ? console.warn : 
                     console.log;

  logFunction(JSON.stringify(logEntry));
} 