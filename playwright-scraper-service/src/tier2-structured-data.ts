/**
 * TIER 2: Structured Data Parser
 * Extracts vehicle data from JSON-LD, Schema.org, and meta tags
 * Very reliable when available
 */

import { Page } from 'playwright';
import { Vehicle, ExtractionResult, DomainPattern } from './types.js';

export class StructuredDataParser {
  /**
   * Extract vehicles from structured data
   */
  async extract(page: Page, domain: string, pageUrl: string): Promise<ExtractionResult | null> {
    // Get all JSON-LD structured data
    const jsonLdData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.map((script) => {
        try {
          return JSON.parse(script.textContent || '');
        } catch {
          return null;
        }
      }).filter(Boolean);
    });

    if (jsonLdData.length === 0) {
      return null;
    }

    console.log(`📋 Found ${jsonLdData.length} JSON-LD structured data block(s)`);

    const vehicles: Vehicle[] = [];

    for (const data of jsonLdData) {
      const extracted = this.parseStructuredData(data, pageUrl);
      vehicles.push(...extracted);
    }

    if (vehicles.length === 0) {
      return null;
    }

    // Create domain pattern for caching
    const pattern: DomainPattern = {
      domain,
      tier: 'structured',
      config: {
        schemaType: 'json-ld',
      },
      lastUsed: new Date(),
      successRate: 1.0,
    };

    console.log(`✅ Tier 2 (Structured Data): Extracted ${vehicles.length} vehicles`);

    return {
      vehicles,
      tier: 'structured',
      confidence: 'high',
      pattern,
    };
  }

  /**
   * Parse structured data (handles nested structures)
   */
  private parseStructuredData(data: any, pageUrl: string): Vehicle[] {
    const vehicles: Vehicle[] = [];

    // Handle arrays
    if (Array.isArray(data)) {
      for (const item of data) {
        vehicles.push(...this.parseStructuredData(item, pageUrl));
      }
      return vehicles;
    }

    // Handle objects
    if (typeof data !== 'object' || data === null) {
      return vehicles;
    }

    // Check if this is a Car/Vehicle schema
    const type = data['@type'];
    if (type === 'Car' || type === 'Vehicle' || type === 'Automobile') {
      const vehicle = this.parseVehicleSchema(data, pageUrl);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    // Check for ItemList containing vehicles
    if (type === 'ItemList') {
      const items = data.itemListElement || data.items || [];
      for (const item of items) {
        const itemData = item.item || item;
        vehicles.push(...this.parseStructuredData(itemData, pageUrl));
      }
    }

    // Recursively search nested objects
    for (const value of Object.values(data)) {
      if (typeof value === 'object' && value !== null) {
        vehicles.push(...this.parseStructuredData(value, pageUrl));
      }
    }

    return vehicles;
  }

  /**
   * Parse a Vehicle/Car schema object
   */
  private parseVehicleSchema(data: any, pageUrl: string): Vehicle | null {
    const vehicle: Vehicle = {
      url: data.url || pageUrl,
    };

    // Year
    if (data.modelDate || data.yearOfProduction || data.productionDate) {
      const yearStr = String(data.modelDate || data.yearOfProduction || data.productionDate);
      const year = parseInt(yearStr.substring(0, 4));
      if (!isNaN(year)) {
        vehicle.year = year;
      }
    } else if (data.vehicleModelDate) {
      const year = parseInt(String(data.vehicleModelDate));
      if (!isNaN(year)) {
        vehicle.year = year;
      }
    }

    // Make
    if (data.brand) {
      if (typeof data.brand === 'string') {
        vehicle.make = data.brand;
      } else if (data.brand.name) {
        vehicle.make = data.brand.name;
      }
    } else if (data.manufacturer) {
      if (typeof data.manufacturer === 'string') {
        vehicle.make = data.manufacturer;
      } else if (data.manufacturer.name) {
        vehicle.make = data.manufacturer.name;
      }
    }

    // Model
    if (data.model) {
      if (typeof data.model === 'string') {
        vehicle.model = data.model;
      } else if (data.model.name) {
        vehicle.model = data.model.name;
      }
    } else if (data.name) {
      vehicle.model = String(data.name);
    }

    // VIN
    if (data.vehicleIdentificationNumber || data.vin) {
      vehicle.vin = String(data.vehicleIdentificationNumber || data.vin);
    }

    // Price
    if (data.offers) {
      const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
      for (const offer of offers) {
        if (offer.price) {
          const price = parseFloat(String(offer.price).replace(/[^0-9.]/g, ''));
          if (!isNaN(price)) {
            vehicle.price = price;
            break;
          }
        }
      }
    } else if (data.price) {
      const price = parseFloat(String(data.price).replace(/[^0-9.]/g, ''));
      if (!isNaN(price)) {
        vehicle.price = price;
      }
    }

    // Mileage
    if (data.mileageFromOdometer) {
      const mileageData = data.mileageFromOdometer;
      let mileageValue = mileageData.value || mileageData;
      if (typeof mileageValue === 'string') {
        mileageValue = mileageValue.replace(/[^0-9]/g, '');
      }
      const mileage = parseInt(String(mileageValue));
      if (!isNaN(mileage)) {
        vehicle.mileage = mileage;
      }
    }

    // Color
    if (data.color) {
      vehicle.color = String(data.color);
    } else if (data.vehicleConfiguration) {
      vehicle.color = String(data.vehicleConfiguration);
    }

    // Trim
    if (data.vehicleConfiguration) {
      vehicle.trim = String(data.vehicleConfiguration);
    } else if (data.trim) {
      vehicle.trim = String(data.trim);
    }

    // Stock number
    if (data.sku || data.stockNumber) {
      vehicle.stock_number = String(data.sku || data.stockNumber);
    }

    // Image
    if (data.image) {
      if (typeof data.image === 'string') {
        vehicle.image_url = data.image;
      } else if (Array.isArray(data.image) && data.image.length > 0) {
        vehicle.image_url = String(data.image[0]);
      } else if (data.image.url) {
        vehicle.image_url = data.image.url;
      }
    }

    // Validate - need at least year+make or VIN
    if ((!vehicle.year || !vehicle.make) && !vehicle.vin) {
      return null;
    }

    return vehicle;
  }

  /**
   * Also try to extract from meta tags as fallback
   */
  async extractFromMetaTags(page: Page, pageUrl: string): Promise<Vehicle | null> {
    const metaData = await page.evaluate(() => {
      const getMeta = (name: string): string | null => {
        const meta =
          document.querySelector(`meta[name="${name}"]`) ||
          document.querySelector(`meta[property="${name}"]`) ||
          document.querySelector(`meta[property="og:${name}"]`);
        return meta ? meta.getAttribute('content') : null;
      };

      return {
        title: document.title || getMeta('title') || getMeta('og:title'),
        description: getMeta('description') || getMeta('og:description'),
        image: getMeta('image') || getMeta('og:image'),
        url: getMeta('url') || getMeta('og:url'),
      };
    });

    // Try to parse vehicle info from title/description
    const text = `${metaData.title} ${metaData.description}`.toLowerCase();

    // Extract year (1990-2039)
    const yearMatch = text.match(/\b(19[9]\d|20[0-3]\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

    // Common car makes
    const makes = [
      'toyota', 'ford', 'chevrolet', 'honda', 'nissan', 'jeep', 'ram', 'gmc',
      'hyundai', 'subaru', 'kia', 'mazda', 'dodge', 'lexus', 'mercedes',
      'bmw', 'audi', 'volkswagen', 'volvo', 'acura', 'infiniti', 'cadillac',
      'buick', 'lincoln', 'chrysler', 'tesla', 'rivian', 'lucid', 'genesis'
    ];

    let make: string | undefined;
    for (const m of makes) {
      if (text.includes(m)) {
        make = m.charAt(0).toUpperCase() + m.slice(1);
        break;
      }
    }

    if (!year || !make) {
      return null;
    }

    const vehicle: Vehicle = {
      year,
      make,
      url: metaData.url || pageUrl,
    };

    if (metaData.image) {
      vehicle.image_url = metaData.image;
    }

    return vehicle;
  }
}
