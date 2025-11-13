// =====================================================
// URL NORMALIZATION UTILITY
// =====================================================
// Handles all URL format variations to ensure consistent processing

/**
 * Normalize a URL to a consistent format
 * Handles: rpm-motors.us, www.rpm-motors.us, https://rpm-motors.us, etc.
 *
 * @param url - URL in any format
 * @returns Canonical URL (https://domain.com)
 *
 * @example
 * normalizeUrl('rpm-motors.us')           // => 'https://rpm-motors.us'
 * normalizeUrl('www.rpm-motors.us')       // => 'https://rpm-motors.us'
 * normalizeUrl('http://rpm-motors.us')    // => 'https://rpm-motors.us'
 * normalizeUrl('rpm-motors.us/inventory') // => 'https://rpm-motors.us/inventory'
 */
export function normalizeUrl(url: string): string {
  if (!url) {
    throw new Error('URL cannot be empty');
  }

  // Trim whitespace
  url = url.trim();

  // Add https:// if no protocol specified
  if (!url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }

  // Upgrade http to https
  url = url.replace(/^http:\/\//, 'https://');

  try {
    const parsed = new URL(url);

    // Remove www. prefix for consistency
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Reconstruct URL with normalized hostname
    return `${parsed.protocol}//${hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Validate if a string is a valid URL
 *
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the base URL (protocol + hostname) from a full URL
 *
 * @param url - Full URL
 * @returns Base URL (e.g., 'https://rpm-motors.us')
 *
 * @example
 * getBaseUrl('https://rpm-motors.us/inventory/vehicle/123')
 * // => 'https://rpm-motors.us'
 */
export function getBaseUrl(url: string): string {
  const normalized = normalizeUrl(url);
  const parsed = new URL(normalized);
  return `${parsed.protocol}//${parsed.hostname}`;
}

/**
 * Resolve a relative URL against a base URL
 *
 * @param relativeUrl - Relative or absolute URL
 * @param baseUrl - Base URL to resolve against
 * @returns Absolute URL
 *
 * @example
 * resolveUrl('/inventory/vehicle/123', 'https://rpm-motors.us')
 * // => 'https://rpm-motors.us/inventory/vehicle/123'
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    const base = normalizeUrl(baseUrl);
    return new URL(relativeUrl, base).href;
  } catch (error) {
    throw new Error(`Failed to resolve URL: ${relativeUrl} against ${baseUrl}`);
  }
}
