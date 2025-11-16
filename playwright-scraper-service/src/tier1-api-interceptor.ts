/**
 * TIER 1: API Interception
 * Intercepts JSON API calls that return vehicle data
 * Most reliable and efficient method
 */

import { Page } from 'playwright';
import { Vehicle, ExtractionResult, DomainPattern } from './types.js';

interface APIResponse {
  url: string;
  data: any;
  method: string;
}

export class APIInterceptor {
  private apiResponses: APIResponse[] = [];

  /**
   * Set up API interception on the page
   */
  async setupInterception(page: Page): Promise<void> {
    this.apiResponses = [];

    page.on('response', async (response) => {
      const url = response.url();
      const method = response.request().method();

      // Look for API-like URLs
      const isAPI =
        url.includes('/api/') ||
        url.includes('/graphql') ||
        url.includes('/v1/') ||
        url.includes('/v2/') ||
        url.includes('/inventory') ||
        url.includes('/vehicles') ||
        url.includes('/search') ||
        url.includes('.json') ||
        url.includes('/products.json') ||
        url.includes('/collections/') ||
        response.headers()['content-type']?.includes('application/json');

      if (isAPI && (method === 'GET' || method === 'POST')) {
        try {
          const data = await response.json();
          console.log(`📡 Intercepted API: ${method} ${url}`);

          // Check if this looks like vehicle data
          if (this.looksLikeVehicleData(data)) {
            console.log(`✅ Found vehicle data in API response`);
            this.apiResponses.push({ url, data, method });
          }
        } catch (error) {
          // Not JSON or failed to parse
        }
      }
    });
  }

  /**
   * Extract vehicles from intercepted API responses
   */
  async extract(page: Page, domain: string): Promise<ExtractionResult | null> {
    if (this.apiResponses.length === 0) {
      return null;
    }

    console.log(`🔍 Analyzing ${this.apiResponses.length} API response(s)...`);

    let allVehicles: Vehicle[] = [];
    let bestResponse: APIResponse | null = null;
    let dataPath: string = '';

    // Try each API response
    for (const response of this.apiResponses) {
      const vehicles = this.parseVehicleData(response.data);
      if (vehicles.length > allVehicles.length) {
        allVehicles = vehicles;
        bestResponse = response;
      }
    }

    if (allVehicles.length === 0 || !bestResponse) {
      return null;
    }

    // Create domain pattern for caching
    const pattern: DomainPattern = {
      domain,
      tier: 'api',
      config: {
        apiEndpoint: bestResponse.url,
        apiMethod: bestResponse.method,
        apiDataPath: dataPath,
      },
      lastUsed: new Date(),
      successRate: 1.0,
    };

    console.log(`✅ Tier 1 (API): Extracted ${allVehicles.length} vehicles`);

    return {
      vehicles: allVehicles,
      tier: 'api',
      confidence: 'high',
      pattern,
    };
  }

  /**
   * Check if data structure looks like vehicle data
   */
  private looksLikeVehicleData(data: any): boolean {
    if (!data) return false;

    // Check for Shopify products structure
    if (data.products && Array.isArray(data.products)) {
      console.log(`🛍️ Detected Shopify products structure`);
      return true;
    }

    // Check if it's an array of objects with vehicle-like properties
    const checkArray = (arr: any[]): boolean => {
      if (arr.length === 0) return false;
      const sample = arr[0];
      if (typeof sample !== 'object') return false;

      // Look for vehicle-related keys
      const keys = Object.keys(sample).map((k) => k.toLowerCase());
      const vehicleKeywords = ['year', 'make', 'model', 'vin', 'price', 'mileage', 'vehicle'];

      return vehicleKeywords.some((keyword) => keys.some((key) => key.includes(keyword)));
    };

    // Check direct array
    if (Array.isArray(data) && checkArray(data)) {
      return true;
    }

    // Check nested objects
    if (typeof data === 'object') {
      for (const key of Object.keys(data)) {
        const value = data[key];
        if (Array.isArray(value) && checkArray(value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse vehicle data from API response
   */
  private parseVehicleData(data: any): Vehicle[] {
    const vehicles: Vehicle[] = [];

    // Check for Shopify products structure
    if (data.products && Array.isArray(data.products)) {
      console.log(`🛍️ Parsing Shopify products as vehicles...`);
      for (const product of data.products) {
        const vehicle = this.parseShopifyProduct(product);
        if (vehicle) {
          vehicles.push(vehicle);
        }
      }
      return vehicles;
    }

    // Find the array of vehicles
    let vehicleArray: any[] = [];

    if (Array.isArray(data)) {
      vehicleArray = data;
    } else if (typeof data === 'object') {
      // Look for arrays in common paths
      const possiblePaths = [
        'vehicles',
        'results',
        'data',
        'items',
        'inventory',
        'listings',
        'cars',
      ];

      for (const path of possiblePaths) {
        if (Array.isArray(data[path])) {
          vehicleArray = data[path];
          break;
        }
      }

      // Deep search if nothing found
      if (vehicleArray.length === 0) {
        vehicleArray = this.findVehicleArray(data);
      }
    }

    // Parse each vehicle
    for (const item of vehicleArray) {
      if (typeof item !== 'object') continue;

      const vehicle = this.parseVehicle(item);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  }

  /**
   * Find vehicle array in nested object
   */
  private findVehicleArray(obj: any): any[] {
    if (Array.isArray(obj)) {
      // Check if this array contains vehicle-like objects
      if (obj.length > 0 && typeof obj[0] === 'object') {
        const keys = Object.keys(obj[0]).map((k) => k.toLowerCase());
        const hasVehicleKeys = ['year', 'make', 'model', 'vin'].some((keyword) =>
          keys.some((key) => key.includes(keyword))
        );
        if (hasVehicleKeys) {
          return obj;
        }
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        const result = this.findVehicleArray(value);
        if (result.length > 0) {
          return result;
        }
      }
    }

    return [];
  }

  /**
   * Parse a single vehicle object
   */
  private parseVehicle(item: any): Vehicle | null {
    // Helper to find value by multiple possible keys
    const findValue = (keywords: string[]): any => {
      const keys = Object.keys(item);
      for (const keyword of keywords) {
        const match = keys.find((k) => k.toLowerCase().includes(keyword));
        if (match && item[match]) {
          return item[match];
        }
      }
      return null;
    };

    // Extract fields using flexible key matching
    const year = findValue(['year', 'yr']);
    const make = findValue(['make', 'manufacturer']);
    const model = findValue(['model']);
    const vin = findValue(['vin']);
    const price = findValue(['price', 'cost', 'msrp']);
    const mileage = findValue(['mileage', 'miles', 'odometer', 'km']);
    const trim = findValue(['trim', 'style', 'series']);
    const color = findValue(['color', 'exterior', 'paint']);
    const stock = findValue(['stock', 'stocknumber', 'stocknum']);
    const url = findValue(['url', 'link', 'href', 'detailurl', 'detailsurl']);
    const image = findValue(['image', 'photo', 'picture', 'img', 'thumbnail']);

    // At minimum need year/make or VIN
    if ((!year || !make) && !vin) {
      return null;
    }

    const vehicle: Vehicle = {
      url: url || '',
    };

    if (year) vehicle.year = typeof year === 'number' ? year : parseInt(String(year));
    if (make) vehicle.make = String(make);
    if (model) vehicle.model = String(model);
    if (vin) vehicle.vin = String(vin);
    if (trim) vehicle.trim = String(trim);
    if (color) vehicle.color = String(color);
    if (stock) vehicle.stock_number = String(stock);

    // Parse price
    if (price) {
      const priceNum = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
      if (!isNaN(priceNum)) {
        vehicle.price = priceNum;
      }
    }

    // Parse mileage
    if (mileage) {
      const mileageNum =
        typeof mileage === 'number' ? mileage : parseInt(String(mileage).replace(/[^0-9]/g, ''));
      if (!isNaN(mileageNum)) {
        vehicle.mileage = mileageNum;
      }
    }

    // Parse image URL
    if (image) {
      if (typeof image === 'string') {
        vehicle.image_url = image;
      } else if (Array.isArray(image) && image.length > 0) {
        vehicle.image_url = String(image[0]);
      } else if (typeof image === 'object' && image.url) {
        vehicle.image_url = String(image.url);
      }
    }

    return vehicle;
  }

  /**
   * Parse a Shopify product as a vehicle
   */
  private parseShopifyProduct(product: any): Vehicle | null {
    if (!product || !product.title) return null;

    // Extract year/make/model from title (e.g., "2020 Toyota Camry")
    const title = String(product.title);
    const titleParts = title.split(' ');

    // Try to extract year (first 4-digit number)
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    // Common car manufacturers for pattern matching
    const makes = ['toyota', 'ford', 'chevrolet', 'chevy', 'honda', 'nissan', 'bmw', 'mercedes', 'audi', 'volkswagen', 'vw', 'mazda', 'subaru', 'hyundai', 'kia', 'jeep', 'ram', 'gmc', 'dodge', 'lexus', 'acura', 'infiniti', 'cadillac', 'buick', 'lincoln', 'tesla', 'volvo', 'porsche', 'land rover', 'jaguar', 'mini', 'fiat', 'alfa romeo', 'maserati', 'bentley', 'rolls-royce', 'ferrari', 'lamborghini', 'mclaren', 'aston martin'];

    let make: string | null = null;
    let model: string | null = null;

    // Find make in title
    const titleLower = title.toLowerCase();
    for (const m of makes) {
      if (titleLower.includes(m)) {
        make = m.charAt(0).toUpperCase() + m.slice(1);
        // Extract model (words after make)
        const makeIndex = titleLower.indexOf(m);
        const afterMake = title.substring(makeIndex + m.length).trim();
        const modelParts = afterMake.split(' ').filter(p => p && !/^\d+$/.test(p));
        if (modelParts.length > 0) {
          model = modelParts[0];
        }
        break;
      }
    }

    // Get price from first variant
    let price: number | undefined;
    if (product.variants && product.variants.length > 0) {
      const priceStr = product.variants[0].price;
      if (priceStr) {
        price = parseFloat(String(priceStr));
      }
    }

    // Get image URL
    let image_url: string | undefined;
    if (product.images && product.images.length > 0) {
      image_url = product.images[0].src || product.images[0];
    } else if (product.image && product.image.src) {
      image_url = product.image.src;
    }

    // Extract mileage from title or body_html
    let mileage: number | undefined;
    const mileageMatch = title.match(/(\d{1,3}(?:,\d{3})*)\s*(miles?|mi)\b/i);
    if (mileageMatch) {
      const miles = parseInt(mileageMatch[1].replace(/,/g, ''));
      // Sanity check: mileage should be reasonable (not year or price)
      if (miles >= 100 && miles <= 500000) {
        mileage = miles;
      }
    } else if (product.body_html) {
      const bodyMatch = product.body_html.match(/(\d{1,3}(?:,\d{3})*)\s*(miles?|mi)\b/i);
      if (bodyMatch) {
        const miles = parseInt(bodyMatch[1].replace(/,/g, ''));
        if (miles >= 100 && miles <= 500000) {
          mileage = miles;
        }
      }
    }

    // Extract VIN from body_html if available
    let vin: string | undefined;
    if (product.body_html) {
      const vinMatch = product.body_html.match(/\bVIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i);
      if (vinMatch) {
        vin = vinMatch[1].toUpperCase();
      }
    }

    // Extract listing date from published_at or created_at
    let listing_date: Date | undefined;
    if (product.published_at) {
      listing_date = new Date(product.published_at);
    } else if (product.created_at) {
      listing_date = new Date(product.created_at);
    }

    // Build URL from handle
    const url = product.handle ? `/products/${product.handle}` : undefined;

    // Need at least year and make, or a price (to indicate it's a vehicle)
    if ((!year || !make) && !price) {
      return null;
    }

    const vehicle: Vehicle = {
      url: url || '',
    };

    if (year) vehicle.year = year;
    if (make) vehicle.make = make;
    if (model) vehicle.model = model;
    if (price) vehicle.price = price;
    if (mileage) vehicle.mileage = mileage;
    if (image_url) vehicle.image_url = image_url;
    if (vin) vehicle.vin = vin;
    if (listing_date) vehicle.listing_date = listing_date;

    // Use product ID as stock number if available
    if (product.id) {
      vehicle.stock_number = String(product.id);
    }

    console.log(`  📦 Extracted: ${year || '?'} ${make || '?'} ${model || '?'} ${vin ? `VIN:${vin.slice(-6)}` : 'no VIN'} ${listing_date ? `Listed:${listing_date.toISOString().split('T')[0]}` : ''}`);

    return vehicle;
  }
}
