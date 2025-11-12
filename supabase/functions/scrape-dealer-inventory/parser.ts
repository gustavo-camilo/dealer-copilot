// =====================================================
// HTML PARSER FOR DEALER WEBSITES
// =====================================================
// This module contains parsers for different dealer website platforms

export interface ParsedVehicle {
  vin?: string;
  stock_number?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number;
  mileage?: number;
  color?: string;
  url?: string;
  images?: string[];
}

/**
 * Main parsing function - tries different strategies
 */
export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  console.log('Parsing HTML inventory...');

  // Try different parsing strategies in order
  const parsers = [
    parseStructuredData, // JSON-LD, schema.org
    parseCommonPlatforms, // WordPress, Dealix, etc.
    parseGenericVehicleCards, // Generic HTML patterns
  ];

  for (const parser of parsers) {
    try {
      const vehicles = parser(html, baseUrl);
      if (vehicles.length > 0) {
        console.log(`Successfully parsed ${vehicles.length} vehicles`);
        return vehicles;
      }
    } catch (error) {
      console.log(`Parser failed: ${error.message}`);
    }
  }

  console.warn('No vehicles found with any parser');
  return [];
}

/**
 * Strategy 1: Parse structured data (JSON-LD, Schema.org)
 * Many modern sites include this for SEO
 */
function parseStructuredData(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Look for JSON-LD script tags
  const jsonLdRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gis;
  const matches = [...html.matchAll(jsonLdRegex)];

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);

      // Handle both single objects and arrays
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item['@type'] === 'Car' || item['@type'] === 'Vehicle') {
          vehicles.push({
            vin: item.vehicleIdentificationNumber,
            year: parseInt(item.modelDate || item.yearOfManufacture),
            make: item.brand?.name || item.manufacturer?.name,
            model: item.model,
            price: parseFloat(item.offers?.price || item.price),
            mileage: parseInt(item.mileageFromOdometer?.value),
            color: item.color,
            url: item.url ? new URL(item.url, baseUrl).href : undefined,
            images: item.image ? (Array.isArray(item.image) ? item.image : [item.image]) : [],
          });
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return vehicles;
}

/**
 * Strategy 2: Parse common dealer platforms
 */
function parseCommonPlatforms(html: string, baseUrl: string): ParsedVehicle[] {
  // Check for WordPress inventory plugins
  if (html.includes('wp-content') || html.includes('wp-inventory')) {
    return parseWordPressInventory(html, baseUrl);
  }

  // Check for Dealix platform
  if (html.includes('dealix') || html.includes('dealer-website')) {
    return parseDealixPlatform(html, baseUrl);
  }

  // Check for common data attributes
  if (html.includes('data-vin') || html.includes('data-vehicle')) {
    return parseDataAttributes(html, baseUrl);
  }

  return [];
}

/**
 * Parse WordPress inventory plugins
 */
function parseWordPressInventory(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Common WordPress patterns
  const patterns = [
    /<div[^>]*class="[^"]*vehicle[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<div[^>]*class="[^"]*inventory-item[^"]*"[^>]*>(.*?)<\/div>/gis,
    /<article[^>]*class="[^"]*vehicle[^"]*"[^>]*>(.*?)<\/article>/gis,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];

    for (const match of matches) {
      const itemHtml = match[1];

      const vehicle: ParsedVehicle = {
        vin: extractAttribute(itemHtml, 'data-vin') || extractVIN(itemHtml),
        stock_number: extractAttribute(itemHtml, 'data-stock'),
        year: parseInt(extractText(itemHtml, /(\d{4})/)?.[1] || '0'),
        make: extractAttribute(itemHtml, 'data-make') || extractMake(itemHtml),
        model: extractAttribute(itemHtml, 'data-model'),
        price: parsePrice(extractText(itemHtml, /\$?([\d,]+)/)?.[1]),
        mileage: parseInt(extractText(itemHtml, /([\d,]+)\s*mi/i)?.[1]?.replace(/,/g, '') || '0'),
        url: extractLink(itemHtml, baseUrl),
        images: extractImages(itemHtml, baseUrl),
      };

      if (vehicle.vin || (vehicle.year && vehicle.make)) {
        vehicles.push(vehicle);
      }
    }
  }

  return vehicles;
}

/**
 * Parse Dealix or similar platforms
 */
function parseDealixPlatform(html: string, baseUrl: string): ParsedVehicle[] {
  // Implementation specific to Dealix platform
  // This would need to be customized based on actual Dealix HTML structure
  return [];
}

/**
 * Parse using data attributes
 */
function parseDataAttributes(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  const pattern = /<[^>]*data-vin="([^"]+)"[^>]*>(.*?)<\/[^>]+>/gis;
  const matches = [...html.matchAll(pattern)];

  for (const match of matches) {
    const vin = match[1];
    const content = match[2];

    vehicles.push({
      vin,
      year: parseInt(extractAttribute(content, 'data-year') || '0'),
      make: extractAttribute(content, 'data-make'),
      model: extractAttribute(content, 'data-model'),
      price: parseFloat(extractAttribute(content, 'data-price') || '0'),
      mileage: parseInt(extractAttribute(content, 'data-mileage') || '0'),
    });
  }

  return vehicles;
}

/**
 * Strategy 3: Generic vehicle card parsing
 * Looks for common HTML patterns across different platforms
 */
function parseGenericVehicleCards(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Look for repeating patterns that might be vehicle listings
  // This is a fallback and may need customization per site
  const cardPatterns = [
    /<div[^>]*class="[^"]*vehicle[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*class="[^"]*car[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*class="[^"]*inventory[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  ];

  // Try each pattern
  for (const pattern of cardPatterns) {
    const matches = [...html.matchAll(pattern)];

    if (matches.length >= 3) {
      // Likely found vehicle cards
      for (const match of matches) {
        const cardHtml = match[0];

        const vehicle: ParsedVehicle = {
          vin: extractVIN(cardHtml),
          year: parseInt(extractText(cardHtml, /\b(19|20)\d{2}\b/)?.[0] || '0'),
          make: extractMake(cardHtml),
          price: parsePrice(extractText(cardHtml, /\$[\d,]+/)?.[0]),
          mileage: parseInt(
            extractText(cardHtml, /([\d,]+)\s*(?:mi|miles|km)/i)?.[1]?.replace(/,/g, '') || '0'
          ),
          url: extractLink(cardHtml, baseUrl),
          images: extractImages(cardHtml, baseUrl),
        };

        if (vehicle.year && vehicle.make) {
          vehicles.push(vehicle);
        }
      }

      if (vehicles.length > 0) {
        break; // Found vehicles, stop trying patterns
      }
    }
  }

  return vehicles;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function extractAttribute(html: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}="([^"]+)"`, 'i');
  const match = html.match(regex);
  return match?.[1];
}

function extractText(html: string, regex: RegExp): RegExpMatchArray | null {
  return html.match(regex);
}

function extractVIN(html: string): string | undefined {
  // VIN is 17 alphanumeric characters (no I, O, Q)
  const vinRegex = /\b[A-HJ-NPR-Z0-9]{17}\b/;
  const match = html.match(vinRegex);
  return match?.[0];
}

function extractMake(html: string): string | undefined {
  // Common car makes
  const makes = [
    'Toyota',
    'Honda',
    'Ford',
    'Chevrolet',
    'Nissan',
    'BMW',
    'Mercedes',
    'Volkswagen',
    'Audi',
    'Lexus',
    'Mazda',
    'Subaru',
    'Hyundai',
    'Kia',
    'Jeep',
    'Ram',
    'GMC',
    'Cadillac',
    'Dodge',
    'Chrysler',
  ];

  for (const make of makes) {
    if (html.toLowerCase().includes(make.toLowerCase())) {
      return make;
    }
  }

  return undefined;
}

function parsePrice(priceStr?: string): number | undefined {
  if (!priceStr) return undefined;
  const cleaned = priceStr.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function extractLink(html: string, baseUrl: string): string | undefined {
  const regex = /<a[^>]*href="([^"]+)"/i;
  const match = html.match(regex);
  if (match) {
    return new URL(match[1], baseUrl).href;
  }
  return undefined;
}

function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]*src="([^"]+)"/gi;
  const matches = [...html.matchAll(imgRegex)];

  for (const match of matches) {
    try {
      const url = new URL(match[1], baseUrl).href;
      images.push(url);
    } catch {
      // Invalid URL, skip
    }
  }

  return images;
}
