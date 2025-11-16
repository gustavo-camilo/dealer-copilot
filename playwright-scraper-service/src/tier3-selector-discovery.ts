/**
 * TIER 3: Smart Selector Discovery
 * Automatically discovers CSS selectors for vehicle data
 * Uses common patterns and heuristics
 */

import { Page } from 'playwright';
import { Vehicle, ExtractionResult, DomainPattern } from './types.js';

export class SelectorDiscovery {
  /**
   * Discover and extract vehicles using smart selector patterns
   */
  async extract(page: Page, domain: string, pageUrl: string): Promise<ExtractionResult | null> {
    console.log(`🔍 Tier 3: Discovering selectors...`);

    // Common container selectors for vehicle cards
    const containerSelectors = [
      '[data-test*="vehicle"]',
      '[data-testid*="vehicle"]',
      '[class*="vehicle-card"]',
      '[class*="vehicle-item"]',
      '[class*="inventory-card"]',
      '[class*="car-card"]',
      '[class*="listing"]',
      '.vehicle',
      '.car-item',
      '.inventory-item',
      'article',
      '[itemtype*="Vehicle"]',
      '[itemtype*="Car"]',
    ];

    let bestResult: { selector: string; vehicles: Vehicle[] } | null = null;

    // Try each container selector
    for (const selector of containerSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count === 0) continue;

        console.log(`  Testing selector: ${selector} (${count} matches)`);

        const vehicles = await this.extractFromContainers(page, selector, pageUrl);

        if (vehicles.length > 0) {
          console.log(`  ✓ Found ${vehicles.length} vehicles with ${selector}`);

          // Keep the best result (most vehicles with complete data)
          if (!bestResult || vehicles.length > bestResult.vehicles.length) {
            bestResult = { selector, vehicles };
          }
        }
      } catch (error) {
        // Selector failed, try next
      }
    }

    if (!bestResult) {
      return null;
    }

    // Create domain pattern for caching
    const pattern: DomainPattern = {
      domain,
      tier: 'selector',
      config: {
        selectors: {
          container: bestResult.selector,
        },
      },
      lastUsed: new Date(),
      successRate: 1.0,
    };

    console.log(`✅ Tier 3 (Selectors): Extracted ${bestResult.vehicles.length} vehicles`);

    return {
      vehicles: bestResult.vehicles,
      tier: 'selector',
      confidence: 'medium',
      pattern,
    };
  }

  /**
   * Extract vehicles from container elements
   */
  private async extractFromContainers(
    page: Page,
    containerSelector: string,
    baseUrl: string
  ): Promise<Vehicle[]> {
    const vehicles = await page.evaluate(
      ({ selector, url }) => {
        const containers = Array.from(document.querySelectorAll(selector));
        const results: any[] = [];

        // Helper to find text by keywords
        const findText = (element: Element, keywords: string[]): string | null => {
          // Try data attributes first
          for (const keyword of keywords) {
            const dataAttr = element.querySelector(`[data-${keyword}], [data-test*="${keyword}"]`);
            if (dataAttr) {
              const value = dataAttr.getAttribute(`data-${keyword}`) || dataAttr.textContent;
              if (value && value.trim()) return value.trim();
            }
          }

          // Try class-based selection
          for (const keyword of keywords) {
            const classEl = element.querySelector(`[class*="${keyword}"]`);
            if (classEl?.textContent?.trim()) {
              return classEl.textContent.trim();
            }
          }

          // Try tag-based selection (dt/dd pairs)
          const dts = element.querySelectorAll('dt, .label, .key');
          for (const dt of Array.from(dts)) {
            const text = dt.textContent?.toLowerCase() || '';
            for (const keyword of keywords) {
              if (text.includes(keyword)) {
                const dd = dt.nextElementSibling;
                if (dd?.textContent?.trim()) {
                  return dd.textContent.trim();
                }
              }
            }
          }

          // Search all text nodes
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          let prevText = '';

          while ((node = walker.nextNode())) {
            const text = node.textContent?.toLowerCase() || '';
            for (const keyword of keywords) {
              if (text.includes(keyword) || prevText.includes(keyword)) {
                // Get the value (usually follows the keyword)
                const parent = node.parentElement;
                if (parent) {
                  const fullText = parent.textContent?.trim() || '';
                  // Extract value after keyword
                  const parts = fullText.split(/[:|-]/);
                  if (parts.length > 1) {
                    return parts[1].trim();
                  }
                }
              }
            }
            prevText = text;
          }

          return null;
        };

        // Helper to extract number from text
        const extractNumber = (text: string | null): number | null => {
          if (!text) return null;
          const match = text.match(/[\d,]+/);
          if (!match) return null;
          const num = parseInt(match[0].replace(/,/g, ''));
          return isNaN(num) ? null : num;
        };

        for (const container of containers) {
          // Find URL (link)
          const link = container.querySelector('a[href*="/detail"], a[href*="/vehicle"], a[href*="/inventory"], a[href*="/cars"]');
          const vehicleUrl = link ? (link as HTMLAnchorElement).href : url;

          // Extract data
          const yearText = findText(container, ['year', 'yr']);
          const makeText = findText(container, ['make', 'brand', 'manufacturer']);
          const modelText = findText(container, ['model']);
          const priceText = findText(container, ['price', 'cost', 'msrp', '$']);
          const mileageText = findText(container, ['mileage', 'miles', 'odometer', 'km']);
          const vinText = findText(container, ['vin']);
          const stockText = findText(container, ['stock', 'stock#', 'stocknumber']);
          const trimText = findText(container, ['trim', 'style']);
          const colorText = findText(container, ['color', 'exterior']);

          // Parse values
          const year = extractNumber(yearText);
          const price = extractNumber(priceText);
          const mileage = extractNumber(mileageText);

          // Find image
          const img = container.querySelector('img[src*="vehicle"], img[src*="car"], img[src*="auto"], img:not([src*="logo"])');
          const imageUrl = img ? (img as HTMLImageElement).src : null;

          // Need at least year and make
          if (!year || !makeText) {
            continue;
          }

          results.push({
            year,
            make: makeText,
            model: modelText,
            price,
            mileage,
            vin: vinText,
            stock_number: stockText,
            trim: trimText,
            color: colorText,
            url: vehicleUrl,
            image_url: imageUrl,
          });
        }

        return results;
      },
      { selector: containerSelector, url: baseUrl }
    );

    return vehicles.filter(v => v.year && v.make) as Vehicle[];
  }

  /**
   * Extract using cached domain pattern
   */
  async extractWithPattern(
    page: Page,
    pattern: DomainPattern,
    pageUrl: string
  ): Promise<Vehicle[]> {
    if (!pattern.config.selectors?.container) {
      return [];
    }

    console.log(`📦 Using cached selector: ${pattern.config.selectors.container}`);

    return this.extractFromContainers(page, pattern.config.selectors.container, pageUrl);
  }
}
