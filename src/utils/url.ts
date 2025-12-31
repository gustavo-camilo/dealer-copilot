/**
 * Utility functions for URL handling and normalization
 */

/**
 * Normalizes a URL to a bare domain format (e.g. example.com)
 * Strips protocols, www., and trailing slashes/paths
 */
export const normalizeDomain = (url: string | null | undefined): string => {
    if (!url) return '';

    try {
        // Trim and lowercase first
        let clean = url.trim().toLowerCase();

        // Remove protocols
        clean = clean.replace(/^https?:\/\//i, '');

        // Remove www.
        clean = clean.replace(/^www\./i, '');

        // Remove paths and query params (split by first slash)
        clean = clean.split('/')[0];

        return clean;
    } catch (error) {
        console.warn('Error normalizing domain:', url, error);
        return url || '';
    }
};

/**
 * Ensures a URL starts with https:// for clickable links
 * Used when displaying "Domain Only" strings in href attributes
 */
export const ensureHttps = (url: string | null | undefined): string => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};
