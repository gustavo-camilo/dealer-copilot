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
}
