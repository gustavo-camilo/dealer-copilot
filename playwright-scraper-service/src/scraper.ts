/**
 * Main Scraper Orchestrator
 * Coordinates all 4 extraction tiers and manages browser automation
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'playwright';
import { APIInterceptor } from './tier1-api-interceptor.js';
import { StructuredDataParser } from './tier2-structured-data.js';
import { SelectorDiscovery } from './tier3-selector-discovery.js';
import { LLMVisionExtractor } from './tier4-llm-vision.js';
import { PatternCache } from './pattern-cache.js';
import { Vehicle, ScrapeRequest, ScrapeResponse, DomainPattern } from './types.js';

// Enable stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

export class RobustScraper {
  private browser: Browser | null = null;
  private patternCache: PatternCache;
  private llmExtractor: LLMVisionExtractor;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    anthropicApiKey: string
  ) {
    this.patternCache = new PatternCache(supabaseUrl, supabaseKey);
    this.llmExtractor = new LLMVisionExtractor(anthropicApiKey);
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--allow-insecure-localhost',
        ],
      });
      console.log('✅ Browser initialized with stealth mode');
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }

  /**
   * Main scraping method - tries all 4 tiers
   */
  async scrape(request: ScrapeRequest): Promise<ScrapeResponse> {
    const startTime = Date.now();
    let context;
    let page;

    try {
      await this.initialize();

      const url = new URL(request.url);
      const domain = url.hostname;

      console.log(`\n🚀 Starting scrape for: ${domain}`);
      console.log(`   URL: ${request.url}`);

      // Try to get cached pattern first
      let cachedPattern: DomainPattern | null = null;
      if (request.useCachedPattern !== false) {
        cachedPattern = await this.patternCache.get(domain);
      }

      context = await this.browser!.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
      });

      page = await context.newPage();

      // Set up API interceptor before navigation
      const apiInterceptor = new APIInterceptor();
      await apiInterceptor.setupInterception(page);

      // Navigate to page
      console.log('📄 Loading page...');
      try {
        await page.goto(request.url, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch (error) {
        console.log('⚠️  Page load timeout, continuing anyway...');
      }

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);

      // Check if this is a Shopify store and proactively fetch products API
      let isShopify = false;
      try {
        isShopify = await page.evaluate(() => {
          return !!(window as any).Shopify || document.querySelector('[data-shopify]') !== null;
        }).catch(() => false);
      } catch (e) {
        // Page might have navigated, continue without Shopify detection
        console.log('⚠️ Could not detect Shopify (page might have navigated)');
      }

      if (isShopify) {
        console.log('🛍️ Detected Shopify store, fetching products API...');
        try {
          // Fetch products API using Playwright's native request context (more reliable)
          const currentUrl = new URL(request.url);
          const apiUrls = [
            `${currentUrl.origin}/products.json`,
            `${currentUrl.origin}/collections/all/products.json`,
          ];

          for (const apiUrl of apiUrls) {
            try {
              // Use context.request instead of page.evaluate to avoid execution context issues
              const response = await context.request.get(apiUrl);

              if (response.ok()) {
                const data = await response.json();
                if (data && data.products) {
                  console.log(`✅ Fetched Shopify API: ${apiUrl} (${data.products.length} products)`);
                  // Manually inject into API interceptor
                  apiInterceptor['apiResponses'].push({
                    url: apiUrl,
                    data: data,
                    method: 'GET'
                  });
                  break;
                }
              }
            } catch (e: any) {
              // Try next URL
              console.log(`⚠️ Failed to fetch ${apiUrl}: ${e?.message || 'Unknown error'}`);
            }
          }
        } catch (error: any) {
          console.log(`⚠️ Failed to fetch Shopify API: ${error?.message || 'Unknown error'}, continuing...`);
        }
      }

      let result: ScrapeResponse | null = null;

      // TIER 1: Try cached pattern first (if available and same tier)
      if (cachedPattern) {
        console.log(`\n📦 Trying cached pattern (Tier ${cachedPattern.tier})...`);
        const vehicles = await this.tryWithCachedPattern(page, cachedPattern, request.url);

        if (vehicles.length > 0) {
          result = {
            success: true,
            vehicles,
            tier: `${cachedPattern.tier} (cached)`,
            confidence: 'high',
            pagesScraped: 1,
            duration: Date.now() - startTime,
          };

          await this.patternCache.updateSuccessRate(domain, true);
        } else {
          console.log('❌ Cached pattern failed');
          await this.patternCache.updateSuccessRate(domain, false);
        }
      }

      // If cached pattern didn't work, try the 4 tiers
      if (!result) {
        // TIER 1: API Interception
        console.log('\n🔹 TIER 1: Checking for API endpoints...');
        const tier1Result = await apiInterceptor.extract(page, domain);

        if (tier1Result && tier1Result.vehicles.length > 0) {
          result = {
            success: true,
            vehicles: tier1Result.vehicles,
            tier: 'api',
            confidence: tier1Result.confidence,
            pagesScraped: 1,
            duration: Date.now() - startTime,
          };

          // Save pattern
          if (tier1Result.pattern) {
            await this.patternCache.save(tier1Result.pattern);
          }
        }
      }

      // TIER 2: Structured Data
      if (!result) {
        console.log('\n🔹 TIER 2: Checking for structured data...');
        const structuredParser = new StructuredDataParser();
        const tier2Result = await structuredParser.extract(page, domain, request.url);

        if (tier2Result && tier2Result.vehicles.length > 0) {
          result = {
            success: true,
            vehicles: tier2Result.vehicles,
            tier: 'structured',
            confidence: tier2Result.confidence,
            pagesScraped: 1,
            duration: Date.now() - startTime,
          };

          // Save pattern
          if (tier2Result.pattern) {
            await this.patternCache.save(tier2Result.pattern);
          }
        }
      }

      // TIER 3: Smart Selector Discovery
      if (!result) {
        console.log('\n🔹 TIER 3: Discovering selectors...');
        const selectorDiscovery = new SelectorDiscovery();
        const tier3Result = await selectorDiscovery.extract(page, domain, request.url);

        if (tier3Result && tier3Result.vehicles.length > 0) {
          result = {
            success: true,
            vehicles: tier3Result.vehicles,
            tier: 'selector',
            confidence: tier3Result.confidence,
            pagesScraped: 1,
            duration: Date.now() - startTime,
          };

          // Save pattern
          if (tier3Result.pattern) {
            await this.patternCache.save(tier3Result.pattern);
          }
        }
      }

      // TIER 4: LLM Vision Fallback
      if (!result) {
        console.log('\n🔹 TIER 4: Using Claude Vision (last resort)...');
        const tier4Result = await this.llmExtractor.extract(page, domain, request.url);

        if (tier4Result && tier4Result.vehicles.length > 0) {
          result = {
            success: true,
            vehicles: tier4Result.vehicles,
            tier: 'llm',
            confidence: tier4Result.confidence,
            pagesScraped: 1,
            duration: Date.now() - startTime,
          };

          // Try to learn pattern for future use
          const learnedPattern = await this.llmExtractor.learnPattern(
            page,
            tier4Result.vehicles
          );

          if (learnedPattern && learnedPattern.container) {
            const pattern: DomainPattern = {
              domain,
              tier: 'selector',
              config: {
                selectors: learnedPattern,
              },
              lastUsed: new Date(),
              successRate: 1.0,
            };
            await this.patternCache.save(pattern);
            console.log('🧠 Learned and cached pattern for future use');
          }
        }
      }

      // If still no result, return failure
      if (!result) {
        return {
          success: false,
          vehicles: [],
          tier: 'none',
          confidence: 'low',
          error: 'No extraction method succeeded',
          pagesScraped: 1,
          duration: Date.now() - startTime,
        };
      }

      console.log(`\n✅ SUCCESS: Extracted ${result.vehicles.length} vehicles using Tier ${result.tier}`);
      console.log(`   Duration: ${result.duration}ms`);

      return result;
    } catch (error: any) {
      console.error('Scraping error:', error);

      return {
        success: false,
        vehicles: [],
        tier: 'none',
        confidence: 'low',
        error: error.message,
        pagesScraped: 0,
        duration: Date.now() - startTime,
      };
    } finally {
      // Always close context to prevent resource leaks
      try {
        if (context) {
          await context.close();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Try extraction with cached pattern
   */
  private async tryWithCachedPattern(
    page: Page,
    pattern: DomainPattern,
    pageUrl: string
  ): Promise<Vehicle[]> {
    try {
      switch (pattern.tier) {
        case 'api':
          // For API patterns, we already intercepted during page load
          // Just check if we got the expected endpoint
          return [];

        case 'structured':
          // Structured data should still be there
          const structuredParser = new StructuredDataParser();
          const result = await structuredParser.extract(page, pattern.domain, pageUrl);
          return result?.vehicles || [];

        case 'selector':
          // Use cached selectors
          const selectorDiscovery = new SelectorDiscovery();
          return await selectorDiscovery.extractWithPattern(page, pattern, pageUrl);

        default:
          return [];
      }
    } catch (error) {
      console.error('Error using cached pattern:', error);
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return this.browser !== null;
    } catch {
      return false;
    }
  }
}
