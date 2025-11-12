// =====================================================
// DATE EXTRACTION UTILITIES
// =====================================================
// Hybrid approach to extract accurate listing dates from dealer websites

export interface ListingDateResult {
  date: Date;
  confidence: 'high' | 'medium' | 'low' | 'estimated';
  source: 'image_filename' | 'json_ld' | 'meta_tag' | 'sitemap' | 'visible_text' | 'http_header' | 'first_scan';
}

export interface SitemapCache {
  [urlPath: string]: string; // { "/inventory/vin-123": "2025-11-01" }
}

/**
 * Main function to extract listing date using multiple strategies
 */
export async function getActualListingDate(
  html: string,
  vehicleUrl: string,
  sitemapCache?: SitemapCache,
  imageDate?: Date
): Promise<ListingDateResult> {
  // Priority 0: Date extracted from vehicle image filenames (very reliable for new listings)
  if (imageDate) {
    return {
      date: imageDate,
      confidence: 'high',
      source: 'image_filename',
    };
  }

  // Priority 1: JSON-LD structured data (most reliable)
  const jsonLdDate = extractJsonLdDate(html);
  if (jsonLdDate) {
    return jsonLdDate;
  }

  // Priority 2: HTML meta tags
  const metaDate = extractMetaTagDate(html);
  if (metaDate) {
    return metaDate;
  }

  // Priority 3: Sitemap (pre-fetched, no extra request)
  if (sitemapCache) {
    const sitemapDate = extractSitemapDate(vehicleUrl, sitemapCache);
    if (sitemapDate) {
      return sitemapDate;
    }
  }

  // Priority 4: Visible date text in HTML
  const visibleDate = extractVisibleDate(html);
  if (visibleDate) {
    return visibleDate;
  }

  // Fall back to NOW (mark as estimated)
  return {
    date: new Date(),
    confidence: 'estimated',
    source: 'first_scan',
  };
}

/**
 * Extract date from JSON-LD structured data
 */
function extractJsonLdDate(html: string): ListingDateResult | null {
  try {
    const jsonLdRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gis;
    const matches = [...html.matchAll(jsonLdRegex)];

    for (const match of matches) {
      try {
        const data = JSON.parse(match[1]);

        // Handle both single objects and arrays
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          // Check for Car or Vehicle type
          if (item['@type'] === 'Car' || item['@type'] === 'Vehicle') {
            // Try different date fields
            const dateFields = [
              'datePosted',
              'datePublished',
              'dateCreated',
              'uploadDate',
            ];

            for (const field of dateFields) {
              if (item[field]) {
                const date = new Date(item[field]);
                if (!isNaN(date.getTime()) && isReasonableDate(date)) {
                  return {
                    date,
                    confidence: 'high',
                    source: 'json_ld',
                  };
                }
              }
            }
          }
        }
      } catch (e) {
        // Invalid JSON in this script tag, try next one
        continue;
      }
    }
  } catch (error) {
    console.log('Error parsing JSON-LD:', error.message);
  }

  return null;
}

/**
 * Extract date from HTML meta tags
 */
function extractMetaTagDate(html: string): ListingDateResult | null {
  const metaPatterns = [
    // OpenGraph and Article meta tags
    /<meta\s+property="(?:article:published_time|og:updated_time)"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="(?:article:published_time|og:updated_time)"/i,

    // Standard meta tags
    /<meta\s+name="(?:datePosted|date|pubdate|publishdate)"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="(?:datePosted|date|pubdate|publishdate)"/i,

    // DC (Dublin Core) meta tags
    /<meta\s+name="DC\.date"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="DC\.date"/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime()) && isReasonableDate(date)) {
        return {
          date,
          confidence: 'high',
          source: 'meta_tag',
        };
      }
    }
  }

  return null;
}

/**
 * Extract date from sitemap cache
 */
function extractSitemapDate(
  vehicleUrl: string,
  sitemapCache: SitemapCache
): ListingDateResult | null {
  try {
    const url = new URL(vehicleUrl);
    const urlPath = url.pathname;

    // Check exact match
    if (sitemapCache[urlPath]) {
      const date = new Date(sitemapCache[urlPath]);
      if (!isNaN(date.getTime()) && isReasonableDate(date)) {
        return {
          date,
          confidence: 'medium',
          source: 'sitemap',
        };
      }
    }

    // Try partial match (in case URL has query params or fragments)
    for (const [cachedPath, dateStr] of Object.entries(sitemapCache)) {
      if (urlPath.includes(cachedPath) || cachedPath.includes(urlPath)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && isReasonableDate(date)) {
          return {
            date,
            confidence: 'medium',
            source: 'sitemap',
          };
        }
      }
    }
  } catch (error) {
    console.log('Error extracting sitemap date:', error.message);
  }

  return null;
}

/**
 * Extract visible date text from HTML
 */
function extractVisibleDate(html: string): ListingDateResult | null {
  const visibleDatePatterns = [
    // "Listed: November 1, 2025" or "Posted: Nov 1, 2025"
    /(?:Listed|Posted|Added|Published)[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,

    // "Date Listed: 11/01/2025" or "Posted on: 11/01/2025"
    /(?:Date\s+Listed|Posted\s+on|Added\s+on)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,

    // ISO format in visible text: "2025-11-01"
    /(?:Listed|Posted|Added)[:\s]+(20\d{2}-\d{2}-\d{2})/i,
  ];

  for (const pattern of visibleDatePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      try {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime()) && isReasonableDate(date)) {
          return {
            date,
            confidence: 'medium',
            source: 'visible_text',
          };
        }
      } catch (e) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Validate that a date is reasonable (not in future, not too old)
 */
function isReasonableDate(date: Date): boolean {
  const now = new Date();
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(now.getFullYear() - 3);

  // Date should be between 3 years ago and tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return date >= threeYearsAgo && date <= tomorrow;
}

/**
 * Fetch and parse sitemap.xml for a website
 */
export async function fetchSitemap(baseUrl: string): Promise<SitemapCache> {
  const cache: SitemapCache = {};

  try {
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap-inventory.xml`,
      `${baseUrl}/inventory-sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        console.log(`Fetching sitemap: ${sitemapUrl}`);

        const response = await fetch(sitemapUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          console.log(`Sitemap not found: ${sitemapUrl} (${response.status})`);
          continue;
        }

        const xml = await response.text();

        // Parse sitemap XML
        const urlMatches = xml.matchAll(
          /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/gs
        );

        for (const match of urlMatches) {
          const url = match[1];
          const lastmod = match[2];

          if (lastmod) {
            try {
              const urlPath = new URL(url).pathname;
              cache[urlPath] = lastmod;
            } catch {
              // Invalid URL, skip
            }
          }
        }

        // If we found URLs, we're done
        if (Object.keys(cache).length > 0) {
          console.log(`Parsed ${Object.keys(cache).length} URLs from sitemap`);
          break;
        }

        // Check for sitemap index (multiple sitemaps)
        const sitemapMatches = xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gs);

        for (const sitemapMatch of sitemapMatches) {
          const childSitemapUrl = sitemapMatch[1];

          // Only fetch inventory-related child sitemaps
          if (
            childSitemapUrl.includes('inventory') ||
            childSitemapUrl.includes('vehicle') ||
            childSitemapUrl.includes('car')
          ) {
            try {
              const childResponse = await fetch(childSitemapUrl, {
                signal: AbortSignal.timeout(10000),
              });

              if (childResponse.ok) {
                const childXml = await childResponse.text();
                const childUrls = childXml.matchAll(
                  /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/gs
                );

                for (const childMatch of childUrls) {
                  const url = childMatch[1];
                  const lastmod = childMatch[2];

                  if (lastmod) {
                    try {
                      const urlPath = new URL(url).pathname;
                      cache[urlPath] = lastmod;
                    } catch {
                      // Invalid URL, skip
                    }
                  }
                }
              }
            } catch (error) {
              console.log(`Error fetching child sitemap: ${error.message}`);
            }
          }
        }

        // If we found URLs from child sitemaps, we're done
        if (Object.keys(cache).length > 0) {
          console.log(`Parsed ${Object.keys(cache).length} URLs from sitemap index`);
          break;
        }
      } catch (error) {
        console.log(`Error fetching ${sitemapUrl}:`, error.message);
        continue;
      }
    }
  } catch (error) {
    console.error('Error in fetchSitemap:', error);
  }

  return cache;
}

/**
 * Get or fetch sitemap cache for a tenant
 */
export async function getSitemapCache(
  supabase: any,
  tenant_id: string,
  website_url: string
): Promise<SitemapCache> {
  try {
    // Check if we have a recent cache (< 24 hours old)
    const { data: cached } = await supabase
      .from('sitemap_cache')
      .select('*')
      .eq('tenant_id', tenant_id)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached && cached.fetch_status === 'success') {
      console.log(`Using cached sitemap for tenant ${tenant_id}`);
      return cached.url_dates || {};
    }

    // Fetch fresh sitemap
    console.log(`Fetching fresh sitemap for ${website_url}`);
    const sitemapData = await fetchSitemap(website_url);

    const totalUrls = Object.keys(sitemapData).length;
    const fetchStatus = totalUrls > 0 ? 'success' : 'not_found';

    // Store in cache
    await supabase.from('sitemap_cache').upsert({
      tenant_id,
      website_url,
      url_dates: sitemapData,
      total_urls: totalUrls,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fetch_status: fetchStatus,
      error_message: null,
    });

    console.log(`Cached ${totalUrls} URLs from sitemap`);
    return sitemapData;
  } catch (error) {
    console.error('Error getting sitemap cache:', error);

    // Store error in cache to avoid repeated failures
    await supabase.from('sitemap_cache').upsert({
      tenant_id,
      website_url,
      url_dates: {},
      total_urls: 0,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fetch_status: 'error',
      error_message: error.message,
    });

    return {};
  }
}
