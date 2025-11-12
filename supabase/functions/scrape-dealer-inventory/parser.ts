// =====================================================
// IMPROVED HTML PARSER FOR DEALER WEBSITES
// =====================================================
// This fixes issues with data mixing and extraction failures

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
  imageDate?: Date;
}

/**
 * Main parsing function with improved vehicle card extraction
 */
export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  console.log('🔍 Starting inventory parsing...');

  // Try different strategies in order
  const parsers = [
    parseStructuredData, // JSON-LD (most reliable)
    parseVehicleLinks,   // Link-based extraction (good for most sites)
    parseGenericCards,   // Generic card patterns
  ];

  for (const parser of parsers) {
    try {
      const vehicles = parser(html, baseUrl);
      if (vehicles.length > 0) {
        console.log(`✅ Parser found ${vehicles.length} vehicles`);

        // Validate vehicles have minimum required data
        const validVehicles = vehicles.filter(v =>
          (v.year && v.make) || v.price || v.url
        );

        if (validVehicles.length > 0) {
          console.log(`✅ ${validVehicles.length} valid vehicles after filtering`);
          return validVehicles;
        }
      }
    } catch (error) {
      console.log(`❌ Parser failed: ${error.message}`);
    }
  }

  console.warn('⚠️ No vehicles found with any parser');
  return [];
}

/**
 * Strategy 1: Parse JSON-LD structured data
 */
function parseStructuredData(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  try {
    const jsonLdRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gis;
    const matches = [...html.matchAll(jsonLdRegex)];

    for (const match of matches) {
      try {
        const data = JSON.parse(match[1]);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Car' || item['@type'] === 'Vehicle') {
            const vehicle: ParsedVehicle = {
              vin: item.vehicleIdentificationNumber,
              year: parseInt(item.modelDate || item.yearOfManufacture),
              make: item.brand?.name || item.manufacturer?.name,
              model: item.model,
              price: parseFloat(item.offers?.price || item.price),
              mileage: parseInt(item.mileageFromOdometer?.value),
              color: item.color,
              url: item.url ? new URL(item.url, baseUrl).href : undefined,
              images: item.image ? (Array.isArray(item.image) ? [item.image[0]] : [item.image]) : [],
            };

            if (vehicle.year || vehicle.make) {
              vehicles.push(vehicle);
            }
          }
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }
  } catch (e) {
    // Parsing error
  }

  return vehicles;
}

/**
 * Strategy 2: Parse by finding vehicle links first, then extract data around each link
 * This is more reliable than trying to extract card boundaries
 */
function parseVehicleLinks(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();

  // Find all links that look like vehicle detail pages
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  const matches = [...html.matchAll(linkRegex)];

  console.log(`Found ${matches.length} total links on page`);

  for (const match of matches) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();

    // Skip if link doesn't look like a vehicle
    const hasYear = /\b(19|20)\d{2}\b/.test(linkText);
    const hasMake = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Audi|Lexus|Volkswagen|VW)\b/i.test(linkText);

    if (!hasYear && !hasMake) {
      continue;
    }

    // Check if URL looks like vehicle detail page
    const lowerHref = href.toLowerCase();
    const isVehicleUrl =
      lowerHref.includes('/vehicle') ||
      lowerHref.includes('/inventory/') ||
      lowerHref.includes('/cars/') ||
      lowerHref.includes('/used-') ||
      lowerHref.includes('-for-sale') ||
      lowerHref.includes('/detail') ||
      /\/\d+/.test(href);

    if (!isVehicleUrl || lowerHref.includes('/search') || lowerHref === '/' || href.startsWith('#')) {
      continue;
    }

    try {
      const fullUrl = new URL(href, baseUrl).href;

      // Skip duplicates
      if (seenUrls.has(fullUrl)) {
        continue;
      }
      seenUrls.add(fullUrl);

      // Get context around this link (500 chars before and after)
      const matchIndex = html.indexOf(match[0]);
      const contextStart = Math.max(0, matchIndex - 500);
      const contextEnd = Math.min(html.length, matchIndex + match[0].length + 500);
      const context = html.substring(contextStart, contextEnd);

      // Parse vehicle data from context
      const vehicle = parseVehicleContext(context, linkText, fullUrl, baseUrl);

      if (vehicle.year && vehicle.make) {
        vehicles.push(vehicle);
      }
    } catch (e) {
      // Invalid URL
      continue;
    }
  }

  console.log(`Found ${vehicles.length} vehicles with valid URLs`);
  return vehicles;
}

/**
 * Parse vehicle data from context around a link
 */
function parseVehicleContext(context: string, linkText: string, url: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = { url };

  // Extract year
  const yearMatch = context.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) vehicle.year = parseInt(yearMatch[1]);

  // Extract make
  const makePattern = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Audi|Lexus|Acura|Infiniti|Cadillac|Volkswagen|VW|Volvo)\b/i;
  const makeMatch = context.match(makePattern);
  if (makeMatch) vehicle.make = makeMatch[1];

  // Extract model (word after make)
  if (vehicle.make) {
    const modelPattern = new RegExp(`${vehicle.make}\\s+([A-Za-z0-9\\-]+)`, 'i');
    const modelMatch = context.match(modelPattern);
    if (modelMatch) vehicle.model = modelMatch[1];
  }

  // Extract price
  const pricePattern = /\$\s*([\d,]+)/;
  const priceMatch = context.match(pricePattern);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price > 1000 && price < 500000) {
      vehicle.price = price;
    }
  }

  // Extract mileage
  const mileagePattern = /([\d,]+)\s*(?:mi|miles|km)/i;
  const mileageMatch = context.match(mileagePattern);
  if (mileageMatch) {
    const mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
    if (mileage < 999999) {
      vehicle.mileage = mileage;
    }
  }

  // Extract first good image from context
  const images = extractFirstGoodImage(context, baseUrl);
  if (images.length > 0) {
    vehicle.images = images;
    vehicle.imageDate = extractDateFromImageFilename(images[0]);
  }

  return vehicle;
}

/**
 * Strategy 3: Generic card parsing (fallback)
 */
function parseGenericCards(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Look for repeating sections with vehicle data
  const sections = html.split(/(?=<div|<article|<li)/i);

  for (const section of sections) {
    if (section.length < 100) continue; // Too small to be a vehicle card

    const hasVehicleKeywords =
      /vehicle|inventory|car|listing/i.test(section) ||
      /\b(19|20)\d{2}\b/.test(section); // Has year

    if (!hasVehicleKeywords) continue;

    const vehicle = parseVehicleContext(section, '', '', baseUrl);

    // Only include if we got substantial data
    if ((vehicle.year && vehicle.make) || (vehicle.price && vehicle.url)) {
      vehicles.push(vehicle);
    }
  }

  return vehicles;
}

/**
 * Extract first good vehicle image (filter out logos/icons)
 */
function extractFirstGoodImage(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];

  for (const match of matches) {
    const imgTag = match[0];
    const imgSrc = match[1];
    const lowerSrc = imgSrc.toLowerCase();
    const lowerTag = imgTag.toLowerCase();

    // Filter out non-vehicle images
    if (
      lowerSrc.includes('logo') ||
      lowerSrc.includes('icon') ||
      lowerSrc.includes('badge') ||
      lowerSrc.includes('social') ||
      lowerSrc.includes('nav') ||
      lowerSrc.includes('menu') ||
      lowerSrc.includes('header') ||
      lowerSrc.includes('footer') ||
      lowerSrc.includes('banner') ||
      lowerSrc.includes('button') ||
      lowerSrc.includes('.svg') ||
      lowerSrc.includes('.gif') ||
      lowerTag.includes('class="icon') ||
      lowerTag.includes('alt="icon')
    ) {
      continue;
    }

    // Check dimensions
    const widthMatch = imgTag.match(/width=["']?(\d+)/i);
    const heightMatch = imgTag.match(/height=["']?(\d+)/i);
    if (widthMatch && heightMatch) {
      const width = parseInt(widthMatch[1]);
      const height = parseInt(heightMatch[1]);
      if (width < 100 || height < 100) continue;
    }

    try {
      const url = new URL(imgSrc, baseUrl).href;
      return [url]; // Return only first good image
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * Extract date from image filename
 */
function extractDateFromImageFilename(imageUrl: string): Date | undefined {
  const patterns = [
    /IMG[-_](\d{4})(\d{2})(\d{2})/i,
    /photo[-_](\d{4})(\d{2})(\d{2})/i,
    /(\d{4})(\d{2})(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = imageUrl.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);

      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  return undefined;
}
