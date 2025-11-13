// =====================================================
// ROBUST HTTP FETCHER - Retry Logic & Rate Limiting
// =====================================================
// Handles network failures gracefully with:
// - Exponential backoff retry
// - Rate limiting (respectful scraping)
// - Proper error handling
// - Response validation

import { createTimeoutSignal } from '../_shared/timeout.ts';

export interface FetchOptions {
  maxRetries?: number;          // Default: 3
  initialDelayMs?: number;      // Default: 1000 (1 second)
  maxDelayMs?: number;          // Default: 10000 (10 seconds)
  timeout?: number;             // Default: 30000 (30 seconds)
  rateLimitMs?: number;         // Delay between requests (default: 1000ms)
  validateResponse?: boolean;   // Check for error pages (default: true)
}

interface FetchResult {
  success: boolean;
  html?: string;
  status?: number;
  error?: string;
  attempts: number;
}

// Global rate limiter - track last request time per domain
const lastRequestTime: Map<string, number> = new Map();

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract domain from URL for rate limiting
 */
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Wait if we've made a request to this domain recently (rate limiting)
 */
async function enforceRateLimit(url: string, rateLimitMs: number): Promise<void> {
  const domain = getDomain(url);
  const lastRequest = lastRequestTime.get(domain) || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;

  if (timeSinceLastRequest < rateLimitMs) {
    const waitTime = rateLimitMs - timeSinceLastRequest;
    console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before fetching ${domain}`);
    await sleep(waitTime);
  }

  lastRequestTime.set(domain, Date.now());
}

/**
 * Validate that response is not an error page
 */
function validateResponse(html: string, url: string): { valid: boolean; reason?: string } {
  const htmlLower = html.toLowerCase();

  // Check for common error indicators
  const errorIndicators = [
    { pattern: 'page not found', reason: '404 error page' },
    { pattern: '404', reason: '404 in content' },
    { pattern: 'does not exist', reason: 'Page does not exist' },
    { pattern: 'has been removed', reason: 'Page removed' },
    { pattern: 'no longer available', reason: 'No longer available' },
    { pattern: 'access denied', reason: 'Access denied' },
    { pattern: 'forbidden', reason: 'Forbidden' },
  ];

  for (const indicator of errorIndicators) {
    if (htmlLower.includes(indicator.pattern)) {
      return { valid: false, reason: indicator.reason };
    }
  }

  // Check for suspiciously short content (likely error page)
  if (html.length < 500) {
    return { valid: false, reason: 'Content too short (likely error page)' };
  }

  return { valid: true };
}

/**
 * Fetch URL with exponential backoff retry
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    timeout = 30000,
    rateLimitMs = 1000,
    validateResponse: shouldValidate = true,
  } = options;

  let attempts = 0;
  let lastError: string = '';

  // Enforce rate limiting
  await enforceRateLimit(url, rateLimitMs);

  while (attempts < maxRetries) {
    attempts++;

    try {
      console.log(`Fetching ${url} (attempt ${attempts}/${maxRetries})...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: createTimeoutSignal(timeout),
      });

      // Check HTTP status
      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`;

        // Don't retry on 404, 403, 410 (permanent errors)
        if ([404, 403, 410].includes(response.status)) {
          console.log(`❌ Permanent error: ${lastError}`);
          return {
            success: false,
            status: response.status,
            error: lastError,
            attempts,
          };
        }

        // Retry on 5xx errors and 429 (rate limit)
        if (response.status >= 500 || response.status === 429) {
          throw new Error(lastError);
        }

        // Other errors - don't retry
        return {
          success: false,
          status: response.status,
          error: lastError,
          attempts,
        };
      }

      const html = await response.text();

      // Validate response content
      if (shouldValidate) {
        const validation = validateResponse(html, url);
        if (!validation.valid) {
          console.log(`⚠️ Invalid response: ${validation.reason}`);
          return {
            success: false,
            status: response.status,
            error: validation.reason,
            attempts,
          };
        }
      }

      console.log(`✅ Successfully fetched ${url} (${html.length} bytes)`);

      return {
        success: true,
        html,
        status: response.status,
        attempts,
      };

    } catch (error) {
      lastError = error.message;
      console.log(`❌ Attempt ${attempts} failed: ${lastError}`);

      // If this was the last attempt, return error
      if (attempts >= maxRetries) {
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempts - 1),
        maxDelayMs
      );

      console.log(`⏳ Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    error: lastError || 'Max retries exceeded',
    attempts,
  };
}

/**
 * Fetch multiple URLs in parallel with concurrency limit
 */
export async function fetchBatch(
  urls: string[],
  options: FetchOptions & { concurrency?: number } = {}
): Promise<Map<string, FetchResult>> {
  const { concurrency = 5, ...fetchOptions } = options;
  const results = new Map<string, FetchResult>();

  console.log(`📦 Fetching ${urls.length} URLs with concurrency ${concurrency}`);

  // Process URLs in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, Math.min(i + concurrency, urls.length));

    console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)}`);

    const batchPromises = batch.map(async (url) => {
      const result = await fetchWithRetry(url, fetchOptions);
      results.set(url, result);
    });

    await Promise.all(batchPromises);
  }

  const successCount = Array.from(results.values()).filter(r => r.success).length;
  console.log(`✅ Successfully fetched ${successCount}/${urls.length} URLs`);

  return results;
}
