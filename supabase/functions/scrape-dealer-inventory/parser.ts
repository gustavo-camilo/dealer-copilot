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

      const make = extractAttribute(itemHtml, 'data-make') || extractMake(itemHtml);
      const vehicle: ParsedVehicle = {
        vin: extractAttribute(itemHtml, 'data-vin') || extractVIN(itemHtml),
        stock_number: extractAttribute(itemHtml, 'data-stock'),
        year: extractYearFromText(itemHtml),
        make: make,
        model: extractAttribute(itemHtml, 'data-model') || extractModel(itemHtml, make),
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

  // Strategy 3a: Look for links to individual vehicle pages
  const vehicleLinks = extractVehicleLinks(html, baseUrl);

  if (vehicleLinks.length > 0) {
    console.log(`Found ${vehicleLinks.length} potential vehicle links`);

    // For each link, try to extract info from the link text and nearby content
    for (const linkInfo of vehicleLinks) {
      const combinedText = linkInfo.text + ' ' + linkInfo.context;
      const make = extractMake(combinedText);
      const vehicle: ParsedVehicle = {
        url: linkInfo.url,
        year: extractYearFromText(linkInfo.text),
        make: make,
        model: extractModel(combinedText, make),
        vin: extractVIN(linkInfo.context),
        price: parsePrice(extractText(linkInfo.context, /\$[\d,]+/)?.[0]),
        mileage: parseInt(
          extractText(linkInfo.context, /([\d,]+)\s*(?:mi|miles|km)/i)?.[1]?.replace(/,/g, '') ||
            '0'
        ),
      };

      if (vehicle.year && vehicle.make) {
        vehicles.push(vehicle);
      }
    }

    if (vehicles.length > 0) {
      return vehicles;
    }
  }

  // Strategy 3b: Look for repeating card patterns
  const cardPatterns = [
    /<div[^>]*class="[^"]*(?:vehicle|car|inventory)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<article[^>]*class="[^"]*(?:vehicle|car|inventory)[^"]*"[^>]*>[\s\S]*?<\/article>/gi,
    /<li[^>]*class="[^"]*(?:vehicle|car|inventory)[^"]*"[^>]*>[\s\S]*?<\/li>/gi,
  ];

  // Try each pattern
  for (const pattern of cardPatterns) {
    const matches = [...html.matchAll(pattern)];

    if (matches.length >= 2) {
      // Likely found vehicle cards
      for (const match of matches) {
        const cardHtml = match[0];
        const make = extractMake(cardHtml);

        const vehicle: ParsedVehicle = {
          vin: extractVIN(cardHtml),
          year: extractYearFromText(cardHtml),
          make: make,
          model: extractModel(cardHtml, make),
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

/**
 * Extract potential vehicle listing links from HTML
 */
function extractVehicleLinks(
  html: string,
  baseUrl: string
): Array<{ url: string; text: string; context: string }> {
  const links: Array<{ url: string; text: string; context: string }> = [];

  // Look for links that contain year, make, or model patterns
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  const matches = [...html.matchAll(linkRegex)];

  for (const match of matches) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, ''); // Strip HTML tags

    // Check if link text suggests a vehicle
    const hasYear = /\b(19|20)\d{2}\b/.test(linkText);
    const hasMake = extractMake(linkText) !== undefined;

    if (hasYear || hasMake) {
      try {
        const fullUrl = new URL(href, baseUrl).href;

        // Get context around the link (up to 500 chars before and after)
        const matchIndex = html.indexOf(match[0]);
        const contextStart = Math.max(0, matchIndex - 500);
        const contextEnd = Math.min(html.length, matchIndex + match[0].length + 500);
        const context = html.substring(contextStart, contextEnd);

        links.push({
          url: fullUrl,
          text: linkText,
          context: context,
        });
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return links;
}

/**
 * Extract year from text
 */
function extractYearFromText(text: string): number | undefined {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    // Validate year is reasonable (1980-2030)
    if (year >= 1980 && year <= 2030) {
      return year;
    }
  }
  return undefined;
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
  // Common car makes (expanded list)
  const makes = [
    'Acura',
    'Alfa Romeo',
    'Aston Martin',
    'Audi',
    'Bentley',
    'BMW',
    'Buick',
    'Cadillac',
    'Chevrolet',
    'Chevy',
    'Chrysler',
    'Dodge',
    'Ferrari',
    'Fiat',
    'Ford',
    'Genesis',
    'GMC',
    'Honda',
    'Hyundai',
    'Infiniti',
    'Jaguar',
    'Jeep',
    'Kia',
    'Lamborghini',
    'Land Rover',
    'Lexus',
    'Lincoln',
    'Maserati',
    'Mazda',
    'McLaren',
    'Mercedes-Benz',
    'Mercedes',
    'Mini',
    'Mitsubishi',
    'Nissan',
    'Porsche',
    'Ram',
    'Rolls-Royce',
    'Subaru',
    'Tesla',
    'Toyota',
    'Volkswagen',
    'VW',
    'Volvo',
  ];

  // Sort by length (longest first) to match "Mercedes-Benz" before "Mercedes"
  const sortedMakes = makes.sort((a, b) => b.length - a.length);

  for (const make of sortedMakes) {
    // Use word boundary to avoid partial matches
    const regex = new RegExp(`\\b${make}\\b`, 'i');
    if (regex.test(html)) {
      return make;
    }
  }

  return undefined;
}

function extractModel(html: string, make?: string): string | undefined {
  // After finding the make, try to extract the model
  if (!make) return undefined;

  // Look for text pattern: Year Make Model
  // Example: "2020 Toyota Camry" -> extract "Camry"
  const yearMakeModelRegex = new RegExp(
    `\\b(19|20)\\d{2}\\s+${make}\\s+([A-Za-z0-9\\-]+(?:\\s+[A-Za-z0-9\\-]+)?)\\b`,
    'i'
  );
  const match = html.match(yearMakeModelRegex);
  if (match && match[2]) {
    return match[2].trim();
  }

  // Alternative: Look for Make Model pattern without year
  const makeModelRegex = new RegExp(`\\b${make}\\s+([A-Za-z0-9\\-]+(?:\\s+[A-Za-z0-9\\-]+)?)\\b`, 'i');
  const makeModelMatch = html.match(makeModelRegex);
  if (makeModelMatch && makeModelMatch[1]) {
    // Filter out common non-model words
    const excludeWords = ['for', 'sale', 'certified', 'pre', 'owned', 'used', 'new', 'the', 'in'];
    const modelCandidate = makeModelMatch[1].trim();
    if (!excludeWords.includes(modelCandidate.toLowerCase())) {
      return modelCandidate;
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
