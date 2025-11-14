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
 * Convert string to title case (first letter uppercase, rest lowercase)
 * Examples: "TOYOTA" -> "Toyota", "camry" -> "Camry", "F-150" -> "F-150"
 */
function toTitleCase(str: string): string {
  if (!str) return str;

  // Split by spaces and hyphens but keep delimiters
  const words = str.split(/(\s+|-)/);

  return words.map(word => {
    // Skip delimiters (spaces and hyphens)
    if (word === ' ' || word === '-' || word.trim() === '') {
      return word;
    }

    // Handle special cases for alphanumeric like "F-150", "RX-350"
    if (/^[A-Z0-9]+$/i.test(word)) {
      // If it's mixed letters and numbers, keep uppercase letters
      if (/[A-Z]/i.test(word) && /[0-9]/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
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
        // Accept if:
        // 1. Has VIN (most reliable identifier - can look up missing data)
        // 2. Has year AND make (core vehicle identity)
        // 3. Has URL (can fetch detail page for missing data)
        // 4. Has price AND year (likely a vehicle even without make)
        const validVehicles = vehicles.filter(v => {
          const hasVIN = v.vin && v.vin.length === 17;
          const hasYearAndMake = v.year && v.make;
          const hasURL = v.url;
          const hasPriceAndYear = v.price && v.year;

          return hasVIN || hasYearAndMake || hasURL || hasPriceAndYear;
        });

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
            const rawMake = item.brand?.name || item.manufacturer?.name;
            const rawModel = item.model;

            const vehicle: ParsedVehicle = {
              vin: item.vehicleIdentificationNumber,
              year: parseInt(item.modelDate || item.yearOfManufacture),
              make: rawMake ? toTitleCase(rawMake) : undefined,
              model: rawModel ? toTitleCase(rawModel) : undefined,
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

    // Check if link text or URL suggests it's a vehicle (relaxed requirement)
    const hasYear = /\b(19|20)\d{2}\b/.test(linkText);
    const hasMake = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i.test(linkText);

    // Relaxed: Allow if has year OR make OR if URL looks like vehicle detail
    const looksLikeVehicleUrl = href.toLowerCase().includes('/vehicle') ||
                                 href.toLowerCase().includes('/inventory/') ||
                                 href.toLowerCase().includes('/products/') ||
                                 href.toLowerCase().includes('/detail') ||
                                 href.toLowerCase().includes('/details/') ||
                                 href.toLowerCase().includes('/cars-for-sale/');

    if (!hasYear && !hasMake && !looksLikeVehicleUrl) {
      continue;
    }

    // Check if URL looks like vehicle detail page
    const lowerHref = href.toLowerCase();
    const isVehicleUrl =
      lowerHref.includes('/vehicle') ||
      lowerHref.includes('/inventory/') ||
      lowerHref.includes('/products/') ||
      lowerHref.includes('/cars/') ||
      lowerHref.includes('/used-') ||
      lowerHref.includes('-for-sale') ||
      lowerHref.includes('/detail') ||
      lowerHref.includes('/details/') ||
      lowerHref.includes('/cars-for-sale/') ||
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

      // Accept vehicle if it has enough identifying information
      const hasVIN = vehicle.vin && vehicle.vin.length === 17;
      const hasYearAndMake = vehicle.year && vehicle.make;
      const hasPriceAndYear = vehicle.price && vehicle.year;

      if (hasVIN || hasYearAndMake || hasPriceAndYear) {
        const displayName = `${vehicle.year || '????'} ${vehicle.make || '????'} ${vehicle.model || ''}`.trim();
        const vinInfo = vehicle.vin ? ` (VIN: ${vehicle.vin})` : '';
        console.log(`✅ Found vehicle: ${displayName}${vinInfo} - ${fullUrl}`);
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

    let bestCard: string | null = null;

    // Find all opening tags before the link
    const before = searchArea.substring(0, relativePosition);
    const openMatches = [...before.matchAll(openPattern)];

    // Start from nearest opening tag and work backwards
    for (let i = openMatches.length - 1; i >= 0; i--) {
      const openMatch = openMatches[i];
      const openPos = openMatch.index!;

      // Find the MATCHING closing tag (handles nested tags properly)
      const closePos = findMatchingClosingTag(searchArea, openPos, tag);

      if (closePos !== null && closePos > relativePosition) {
        // This container includes the link
        const card = searchArea.substring(openPos, closePos);

        // Validate this looks like a vehicle card
        const hasVehicleContent =
          /\b(19|20)\d{2}\b/.test(card) || // Has year
          /\$[\d,]+/.test(card) || // Has price
          /\d+\s*(?:mi|miles|km)/i.test(card); // Has mileage

        if (hasVehicleContent) {
          bestCard = card;
          break; // Use the nearest container
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
 * Find the matching closing tag for a given opening tag, properly handling nested tags
 * Example: <div><div></div></div> - returns position after the SECOND </div>
 */
function findMatchingClosingTag(html: string, openTagPos: number, tagName: string): number | null {
  const openPattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const closePattern = new RegExp(`</${tagName}>`, 'gi');

  let depth = 1; // We're already at one opening tag
  let searchPos = openTagPos + html.substring(openTagPos).indexOf('>') + 1; // Start after the opening tag

  while (depth > 0 && searchPos < html.length) {
    // Find next opening or closing tag
    openPattern.lastIndex = searchPos;
    closePattern.lastIndex = searchPos;

    const nextOpen = openPattern.exec(html);
    const nextClose = closePattern.exec(html);

    // No more closing tags found
    if (!nextClose) {
      return null;
    }

    // Check if there's an opening tag before the next closing tag
    if (nextOpen && nextOpen.index < nextClose.index) {
      // Found nested opening tag - increase depth
      depth++;
      searchPos = openPattern.lastIndex;
    } else {
      // Found closing tag - decrease depth
      depth--;
      searchPos = closePattern.lastIndex;

      if (depth === 0) {
        // Found the matching closing tag
        return searchPos;
      }
    }
  }

  return null;
}

/**
 * Parse vehicle data from an isolated card
 */
function parseVehicleFromCard(card: string, linkText: string, url: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = { url };

  // Extract VIN - try multiple patterns with flexible matching
  const vinPatterns = [
    /VIN[:\s#]*([A-HJ-NPR-Z0-9]{17})/i,
    /vehicle identification number[:\s#]*([A-HJ-NPR-Z0-9]{17})/i,
    /vin number[:\s#]*([A-HJ-NPR-Z0-9]{17})/i,
    /\b([A-HJ-NPR-Z0-9]{17})\b/, // Generic 17-char pattern
  ];

  for (const pattern of vinPatterns) {
    const vinMatch = card.match(pattern);
    if (vinMatch) {
      // Remove any spaces or dashes that might be in the VIN
      const cleanVin = vinMatch[1].replace(/[\s\-]/g, '').toUpperCase();
      if (cleanVin.length === 17) {
        vehicle.vin = cleanVin;
        console.log(`  VIN: ${vehicle.vin}`);
        break;
      }
    }
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

  // Extract make with comprehensive brand list
  const makePattern = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i;
  const makeMatch = card.match(makePattern);
  if (makeMatch) {
    let make = makeMatch[1]
      .replace(/Chevy/i, 'Chevrolet')
      .replace(/VW/i, 'Volkswagen')
      .replace(/Mercedes-Benz/i, 'Mercedes-Benz')
      .replace(/^Mercedes$/i, 'Mercedes-Benz');
    vehicle.make = toTitleCase(make);
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
      vehicle.model = toTitleCase(modelMatch[1].trim());
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

  // Extract mileage - improved patterns to handle various formats (123456, 123,456, 123.456)
  const mileagePatterns = [
    /mileage[:\s]+([\d,.]+)(?:\s*(?:mi|miles|km|kilometers|<br|<\/|\||$))/i,
    /odometer[:\s]+([\d,.]+)(?:\s*(?:mi|miles|km|kilometers|<br|<\/|\||$))/i,
    /([\d,.]+)\s*(?:mi|miles|km|kilometers)\b/i,
    /miles[:\s]+([\d,.]+)/i,
  ];
  for (const pattern of mileagePatterns) {
    const match = card.match(pattern);
    if (match) {
      // Remove both commas and dots to parse the number
      const mileage = parseInt(match[1].replace(/[,.]/g, ''));
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
      /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i.test(section); // Has make

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
    const hasVIN = vehicle.vin && vehicle.vin.length === 17;
    const hasYearAndMake = vehicle.year && vehicle.make;
    const hasPriceAndYear = vehicle.price && vehicle.year;
    const hasURLAndPrice = vehicle.price && vehicle.url;

    if (hasVIN || hasYearAndMake || hasPriceAndYear || hasURLAndPrice) {
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
