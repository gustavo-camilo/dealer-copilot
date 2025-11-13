// =====================================================
// XML SITEMAP PARSER - Vehicle Discovery
// =====================================================
// Most dealer websites have XML sitemaps that list all vehicle URLs
// This is MORE RELIABLE than crawling because:
// 1. Complete list of all pages
// 2. Last modified dates (detect changes)
// 3. Faster than crawling
// 4. Less likely to be blocked

import { createTimeoutSignal } from './timeout.ts';

export interface SitemapUrl {
  loc: string;           // URL
  lastmod?: string;      // Last modified date
  changefreq?: string;   // Change frequency
  priority?: string;     // Priority
}

/**
 * Discover sitemap URLs from common locations
 */
async function discoverSitemaps(baseUrl: string): Promise<string[]> {
  const sitemaps: string[] = [];

  // Normalize URL
  const url = new URL(baseUrl.match(/^https?:\/\//) ? baseUrl : `https://${baseUrl}`);
  const origin = `${url.protocol}//${url.host}`;

  // Common sitemap locations
  const commonPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/product-sitemap.xml',
    '/inventory-sitemap.xml',
    '/vehicles-sitemap.xml',
    '/used-cars-sitemap.xml',
  ];

  // Try robots.txt first (most reliable)
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
      },
      signal: createTimeoutSignal(10000),
    });

    if (response.ok) {
      const text = await response.text();

      // Extract sitemap URLs from robots.txt
      const sitemapRegex = /Sitemap:\s*(.+)/gi;
      const matches = [...text.matchAll(sitemapRegex)];

      for (const match of matches) {
        const sitemapUrl = match[1].trim();
        sitemaps.push(sitemapUrl);
        console.log(`Found sitemap in robots.txt: ${sitemapUrl}`);
      }
    }
  } catch (error) {
    console.log('Could not fetch robots.txt:', error.message);
  }

  // Try common sitemap paths
  for (const path of commonPaths) {
    const sitemapUrl = `${origin}${path}`;

    // Skip if already found in robots.txt
    if (sitemaps.includes(sitemapUrl)) {
      continue;
    }

    try {
      const response = await fetch(sitemapUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
        },
        signal: createTimeoutSignal(5000),
      });

      if (response.ok) {
        sitemaps.push(sitemapUrl);
        console.log(`Found sitemap at: ${sitemapUrl}`);
      }
    } catch {
      // Not found, continue
    }
  }

  return sitemaps;
}

/**
 * Parse XML sitemap and extract URLs
 */
function parseSitemapXML(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  try {
    // Handle sitemap index (links to other sitemaps)
    const sitemapRegex = /<sitemap>(.*?)<\/sitemap>/gis;
    const sitemapMatches = [...xml.matchAll(sitemapRegex)];

    if (sitemapMatches.length > 0) {
      // This is a sitemap index
      for (const match of sitemapMatches) {
        const locMatch = match[1].match(/<loc>(.*?)<\/loc>/i);
        if (locMatch) {
          urls.push({ loc: locMatch[1].trim() });
        }
      }
      return urls;
    }

    // Parse regular sitemap
    const urlRegex = /<url>(.*?)<\/url>/gis;
    const urlMatches = [...xml.matchAll(urlRegex)];

    for (const match of urlMatches) {
      const urlBlock = match[1];

      const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/i);
      if (!locMatch) continue;

      const url: SitemapUrl = {
        loc: locMatch[1].trim(),
      };

      // Extract optional fields
      const lastmodMatch = urlBlock.match(/<lastmod>(.*?)<\/lastmod>/i);
      if (lastmodMatch) {
        url.lastmod = lastmodMatch[1].trim();
      }

      const changefreqMatch = urlBlock.match(/<changefreq>(.*?)<\/changefreq>/i);
      if (changefreqMatch) {
        url.changefreq = changefreqMatch[1].trim();
      }

      const priorityMatch = urlBlock.match(/<priority>(.*?)<\/priority>/i);
      if (priorityMatch) {
        url.priority = priorityMatch[1].trim();
      }

      urls.push(url);
    }
  } catch (error) {
    console.error('Error parsing sitemap XML:', error.message);
  }

  return urls;
}

/**
 * Filter URLs to find vehicle pages
 */
function filterVehicleUrls(urls: SitemapUrl[]): SitemapUrl[] {
  return urls.filter(urlObj => {
    const url = urlObj.loc.toLowerCase();

    // Patterns that indicate vehicle pages
    const vehiclePatterns = [
      '/vehicle/',
      '/inventory/',
      '/used-',
      '/cars/',
      '-for-sale',
      '/detail/',
      '/stock/',
    ];

    // Patterns to exclude
    const excludePatterns = [
      '/search',
      '/category',
      '/tag',
      '/page/',
      '/blog',
      '/news',
      '/about',
      '/contact',
    ];

    // Check if URL matches vehicle patterns
    const matchesVehicle = vehiclePatterns.some(pattern => url.includes(pattern));

    // Check if URL should be excluded
    const shouldExclude = excludePatterns.some(pattern => url.includes(pattern));

    return matchesVehicle && !shouldExclude;
  });
}

/**
 * Main function: Discover and parse vehicle URLs from sitemaps
 */
export async function getVehicleUrlsFromSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  console.log('🗺️ Discovering sitemaps...');

  const sitemapUrls = await discoverSitemaps(baseUrl);

  if (sitemapUrls.length === 0) {
    console.log('No sitemaps found');
    return [];
  }

  console.log(`Found ${sitemapUrls.length} sitemap(s)`);

  let allUrls: SitemapUrl[] = [];

  // Fetch and parse each sitemap
  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`Fetching sitemap: ${sitemapUrl}`);

      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
        },
        signal: createTimeoutSignal(30000),
      });

      if (!response.ok) {
        console.log(`Failed to fetch sitemap: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const urls = parseSitemapXML(xml);

      console.log(`Parsed ${urls.length} URLs from sitemap`);

      // Check if this is a sitemap index (contains other sitemaps)
      if (urls.length > 0 && urls[0].loc.includes('sitemap')) {
        console.log('This is a sitemap index, fetching child sitemaps...');

        // Recursively fetch child sitemaps
        for (const childUrl of urls) {
          try {
            const childResponse = await fetch(childUrl.loc, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
              },
              signal: createTimeoutSignal(30000),
            });

            if (childResponse.ok) {
              const childXml = await childResponse.text();
              const childUrls = parseSitemapXML(childXml);
              allUrls = allUrls.concat(childUrls);
              console.log(`Fetched ${childUrls.length} URLs from child sitemap`);
            }
          } catch (error) {
            console.log(`Failed to fetch child sitemap: ${error.message}`);
          }
        }
      } else {
        allUrls = allUrls.concat(urls);
      }
    } catch (error) {
      console.error(`Error processing sitemap ${sitemapUrl}:`, error.message);
    }
  }

  // Filter to vehicle pages only
  const vehicleUrls = filterVehicleUrls(allUrls);

  console.log(`Found ${vehicleUrls.length} vehicle URLs in sitemaps`);

  return vehicleUrls;
}
