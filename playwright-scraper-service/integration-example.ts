/**
 * Example: How to integrate Playwright Service with Supabase Edge Functions
 *
 * Copy this code into your Edge Function to replace the current scraping logic
 */

// Environment variable (set in Supabase Edge Function settings)
const PLAYWRIGHT_SERVICE_URL = Deno.env.get('PLAYWRIGHT_SERVICE_URL') || 'http://localhost:3000';

/**
 * Call Playwright service to scrape a website
 */
async function scrapeWithPlaywright(url: string): Promise<any[]> {
  try {
    console.log(`📞 Calling Playwright service for: ${url}`);

    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        useCachedPattern: true, // Use cached patterns for speed
        maxPages: 5, // Optional: limit pagination
      }),
    });

    if (!response.ok) {
      throw new Error(`Playwright service returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      console.error('❌ Playwright scrape failed:', result.error);
      return [];
    }

    console.log(`✅ Playwright found ${result.vehicles.length} vehicles using Tier ${result.tier} (${result.confidence} confidence)`);
    console.log(`   Duration: ${result.duration}ms`);

    return result.vehicles;
  } catch (error) {
    console.error('❌ Failed to call Playwright service:', error);
    return [];
  }
}

/**
 * Example: Update your existing Edge Function
 *
 * Replace this section in scrape-dealer-inventory/index.ts:
 */

// BEFORE (around line 318):
/*
const html = await response.text();
const pageVehicles = parseInventoryHTML(html, url);
*/

// AFTER:
/*
// Try Playwright service first (more robust)
let pageVehicles = await scrapeWithPlaywright(url);

// Fallback to old method if Playwright service is unavailable
if (pageVehicles.length === 0) {
  console.log('⚠️  Playwright service unavailable, falling back to HTML parsing...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0)',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (response.ok) {
    const html = await response.text();
    pageVehicles = parseInventoryHTML(html, url);
  }
}
*/

/**
 * Full integration example for scrape-dealer-inventory Edge Function
 */

serve(async (req) => {
  // ... existing CORS and initialization code ...

  try {
    // ... existing tenant fetching code ...

    for (const tenant of tenants) {
      try {
        console.log(`Scraping ${tenant.name} (${tenant.website_url})...`);

        // Find inventory URLs (keep existing logic)
        const inventoryUrls = await findInventoryPages(tenant.website_url);

        let vehicles: any[] = [];

        // Try each inventory URL with Playwright service
        for (const url of inventoryUrls) {
          try {
            console.log(`Fetching ${url}...`);

            // 🆕 USE PLAYWRIGHT SERVICE
            const pageVehicles = await scrapeWithPlaywright(url);

            console.log(`Found ${pageVehicles.length} vehicles on ${url}`);
            vehicles = vehicles.concat(pageVehicles);

          } catch (error) {
            console.log(`Error fetching ${url}:`, error.message);
          }
        }

        // Continue with existing logic for:
        // - enhanceVehicleData() - you can remove this if Playwright already gets details
        // - getSitemapCache()
        // - processVehicles()
        // - Update snapshot
        // etc.

        // ... rest of existing code ...
      } catch (error) {
        console.error(`Error scraping ${tenant.name}:`, error);
      }
    }

    // ... rest of existing code ...
  } catch (error) {
    console.error('Scraping function error:', error);
    // ... existing error handling ...
  }
});

/**
 * IMPORTANT NOTES:
 *
 * 1. Add PLAYWRIGHT_SERVICE_URL to your Edge Function environment variables:
 *    - Go to Supabase Dashboard → Edge Functions → scrape-dealer-inventory → Settings
 *    - Add: PLAYWRIGHT_SERVICE_URL = https://your-service.railway.app
 *
 * 2. The Playwright service returns vehicles with the same structure as your current parser,
 *    so you can use them directly with your existing processVehicles() function.
 *
 * 3. Keep enhanceVehicleData() if you want to fetch additional details from vehicle pages,
 *    or remove it if Playwright already extracts all needed data.
 *
 * 4. The service automatically handles:
 *    - JavaScript-rendered content
 *    - API interception
 *    - Structured data parsing
 *    - Pattern caching
 *    - LLM fallback for difficult sites
 *
 * 5. Set up monitoring:
 *    - Check Railway logs for scraping activity
 *    - Monitor Anthropic API usage (should be minimal)
 *    - Check Supabase scraper_domain_patterns table to see cached patterns
 */
