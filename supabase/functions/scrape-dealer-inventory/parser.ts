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
    parseVehicleCards,   // Card-based extraction (NEW - better boundaries)
    parseGenericSections,   // Generic section patterns
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
 * Strategy 2: Find vehicle cards by locating links and finding their container
 * This prevents data mixing by ensuring each vehicle's data stays within its own container
 */
function parseVehicleCards(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();

  console.log(`Scanning for vehicle links...`);

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

      // Find the containing card for this link
      const card = findContainingCard(html, match.index!);

      if (!card) {
        console.log(`⚠️ Could not find container for ${fullUrl}`);
        continue;
      }

      // Parse vehicle data from the isolated card
      const vehicle = parseVehicleFromCard(card, linkText, fullUrl, baseUrl);

      if (vehicle.year && vehicle.make) {
        console.log(`✅ Found vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model || ''} - ${fullUrl}`);
        vehicles.push(vehicle);
      }
    } catch (e) {
      // Invalid URL
      console.log(`❌ Invalid URL: ${href}`);
      continue;
    }
  }

  console.log(`Found ${vehicles.length} vehicles with valid data`);
  return vehicles;
}

/**
 * Find the containing HTML card/div for a link at a given position
 * This ensures we only extract data from the correct vehicle's section
 */
function findContainingCard(html: string, linkPosition: number): string | null {
  // Common container tags for vehicle cards
  const containerTags = ['div', 'article', 'li', 'section'];

  // Search backwards from link to find opening tag
  let searchStart = Math.max(0, linkPosition - 3000); // Look up to 3000 chars back
  let searchEnd = Math.min(html.length, linkPosition + 2000); // Look 2000 chars forward

  const searchArea = html.substring(searchStart, searchEnd);
  const relativePosition = linkPosition - searchStart;

  for (const tag of containerTags) {
    // Find the nearest opening tag before the link
    const openPattern = new RegExp(`<${tag}[^>]*>`, 'gi');
    const closePattern = new RegExp(`</${tag}>`, 'gi');

    let bestCard: string | null = null;
    let bestStart = -1;

    // Find all opening tags before the link
    const before = searchArea.substring(0, relativePosition);
    const openMatches = [...before.matchAll(openPattern)];

    for (let i = openMatches.length - 1; i >= 0; i--) {
      const openMatch = openMatches[i];
      const openPos = openMatch.index!;

      // Find corresponding closing tag
      const after = searchArea.substring(openPos);
      const closeMatch = after.match(closePattern);

      if (closeMatch) {
        const closePos = openPos + closeMatch.index! + closeMatch[0].length;

        // Check if this container includes the link
        if (openPos < relativePosition && closePos > relativePosition) {
          const card = searchArea.substring(openPos, closePos);

          // Validate this looks like a vehicle card
          const hasVehicleContent =
            /\b(19|20)\d{2}\b/.test(card) || // Has year
            /\$[\d,]+/.test(card) || // Has price
            /\d+\s*(?:mi|miles|km)/i.test(card); // Has mileage

          if (hasVehicleContent) {
            bestCard = card;
            bestStart = openPos;
            break; // Use the nearest container
          }
        }
      }
    }

    if (bestCard) {
      return bestCard;
    }
  }

  // Fallback: use a fixed window around the link (smaller than before)
  const fallbackStart = Math.max(0, relativePosition - 1000);
  const fallbackEnd = Math.min(searchArea.length, relativePosition + 800);
  return searchArea.substring(fallbackStart, fallbackEnd);
}

/**
 * Parse vehicle data from an isolated card
 */
function parseVehicleFromCard(card: string, linkText: string, url: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = { url };

  // Extract VIN
  const vinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/;
  const vinMatch = card.match(vinPattern);
  if (vinMatch) {
    vehicle.vin = vinMatch[1];
    console.log(`  VIN: ${vehicle.vin}`);
  }

  // Extract stock number
  const stockPatterns = [
    /stock[#\s]*:?\s*([A-Z0-9\-]+)/i,
    /stock number[#\s]*:?\s*([A-Z0-9\-]+)/i,
    /#([A-Z0-9\-]{3,})/,
  ];
  for (const pattern of stockPatterns) {
    const match = card.match(pattern);
    if (match) {
      vehicle.stock_number = match[1];
      console.log(`  Stock: ${vehicle.stock_number}`);
      break;
    }
  }

  // Extract year
  const yearMatch = card.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    vehicle.year = parseInt(yearMatch[1]);
    console.log(`  Year: ${vehicle.year}`);
  }

  // Extract make with more patterns
  const makePattern = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Mercedes-Benz|Audi|Lexus|Acura|Infiniti|Cadillac|Volkswagen|VW|Volvo|Porsche|Land Rover|Jaguar|Tesla|Buick|Chrysler|Lincoln|Genesis)\b/i;
  const makeMatch = card.match(makePattern);
  if (makeMatch) {
    vehicle.make = makeMatch[1].replace('Chevy', 'Chevrolet');
    console.log(`  Make: ${vehicle.make}`);
  }

  // Extract model (word(s) after make, before price/mileage)
  if (vehicle.make) {
    const modelPattern = new RegExp(
      `${vehicle.make}\\s+([A-Za-z0-9][A-Za-z0-9\\s\\-]{0,30}?)\\s*(?:\\$|\\d+\\s*(?:mi|miles)|<|\\||\\n)`,
      'i'
    );
    const modelMatch = card.match(modelPattern);
    if (modelMatch) {
      vehicle.model = modelMatch[1].trim();
      console.log(`  Model: ${vehicle.model}`);
    }
  }

  // Extract trim (if separate from model)
  const trimPatterns = [
    /trim[:\s]+([A-Za-z0-9\s\-]+?)(?:<|\\||$)/i,
    /\b(LT|LS|LTZ|EX|EX-L|Sport|Limited|SE|SEL|SXT|Laramie|Big Horn|Denali|Premier|Platinum|XLT|STX)\b/,
  ];
  for (const pattern of trimPatterns) {
    const match = card.match(pattern);
    if (match && match[1]) {
      vehicle.trim = match[1].trim();
      console.log(`  Trim: ${vehicle.trim}`);
      break;
    }
  }

  // Extract price - be more specific
  const pricePatterns = [
    /\$\s*([\d,]+)\b/,
    /price[:\s]+\$?\s*([\d,]+)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = card.match(pattern);
    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''));
      if (price >= 1000 && price <= 500000) {
        vehicle.price = price;
        console.log(`  Price: $${vehicle.price}`);
        break;
      }
    }
  }

  // Extract mileage - improved patterns
  const mileagePatterns = [
    /([\d,]+)\s*(?:mi|miles)\b/i,
    /mileage[:\s]+([\d,]+)/i,
    /odometer[:\s]+([\d,]+)/i,
  ];
  for (const pattern of mileagePatterns) {
    const match = card.match(pattern);
    if (match) {
      const mileage = parseInt(match[1].replace(/,/g, ''));
      if (mileage >= 0 && mileage < 999999) {
        vehicle.mileage = mileage;
        console.log(`  Mileage: ${vehicle.mileage} mi`);
        break;
      }
    }
  }

  // Extract color
  const colorPatterns = [
    /color[:\s]+([A-Za-z\s]+?)(?:<|\\||$)/i,
    /\b(Black|White|Silver|Gray|Grey|Red|Blue|Green|Yellow|Orange|Brown|Tan|Beige)\b/i,
  ];
  for (const pattern of colorPatterns) {
    const match = card.match(pattern);
    if (match && match[1]) {
      vehicle.color = match[1].trim();
      console.log(`  Color: ${vehicle.color}`);
      break;
    }
  }

  // Extract first good image from THIS CARD ONLY
  const images = extractFirstGoodImage(card, baseUrl);
  if (images.length > 0) {
    vehicle.images = images;
    vehicle.imageDate = extractDateFromImageFilename(images[0]);
    console.log(`  Image: ${images[0]}`);
  }

  return vehicle;
}

/**
 * Strategy 3: Generic section parsing (fallback)
 */
function parseGenericSections(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Split by common container tags
  const sections = html.split(/(?=<(?:div|article|li|section))/i);

  for (const section of sections) {
    if (section.length < 200) continue; // Too small to be a vehicle card

    const hasVehicleKeywords =
      /\b(19|20)\d{2}\b/.test(section) && // Has year
      /\b(Ford|Chevrolet|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC)\b/i.test(section); // Has make

    if (!hasVehicleKeywords) continue;

    // Find URL in this section
    const urlMatch = section.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    let url = '';
    if (urlMatch) {
      try {
        url = new URL(urlMatch[1], baseUrl).href;
      } catch {
        continue;
      }
    }

    const vehicle = parseVehicleFromCard(section, '', url, baseUrl);

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
      lowerSrc.includes('avatar') ||
      lowerSrc.includes('thumbnail') && lowerSrc.includes('user') ||
      lowerSrc.includes('.svg') ||
      lowerSrc.includes('.gif') ||
      lowerSrc.includes('placeholder') ||
      lowerTag.includes('class="icon') ||
      lowerTag.includes('alt="icon')
    ) {
      continue;
    }

    // Check dimensions (skip tiny images)
    const widthMatch = imgTag.match(/width=["']?(\d+)/i);
    const heightMatch = imgTag.match(/height=["']?(\d+)/i);
    if (widthMatch && heightMatch) {
      const width = parseInt(widthMatch[1]);
      const height = parseInt(heightMatch[1]);
      if (width < 100 || height < 100) continue;
    } else if (widthMatch) {
      const width = parseInt(widthMatch[1]);
      if (width < 100) continue;
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
