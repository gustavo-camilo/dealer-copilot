// =====================================================
// ROBUST HTML PARSER FOR COMPETITOR WEBSITES
// =====================================================
// Uses the same container-based approach as dealer inventory parser
// but optimized for competitor analysis data needs

export interface ParsedVehicle {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number;
  mileage?: number;
  url?: string;
}

/**
 * Main parsing function with robust vehicle card extraction
 */
export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  console.log('🔍 Starting competitor inventory parsing...');

  // Try different strategies in order
  const parsers = [
    parseStructuredData,  // JSON-LD (most reliable)
    parseVehicleCards,    // Container-based extraction
    parseGenericSections, // Fallback
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
              year: parseInt(item.modelDate || item.yearOfManufacture),
              make: item.brand?.name || item.manufacturer?.name,
              model: item.model,
              price: parseFloat(item.offers?.price || item.price),
              mileage: parseInt(item.mileageFromOdometer?.value),
              url: item.url ? new URL(item.url, baseUrl).href : undefined,
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
        continue;
      }

      // Parse vehicle data from the isolated card
      const vehicle = parseVehicleFromCard(card, linkText, fullUrl, baseUrl);

      if (vehicle.year && vehicle.make) {
        console.log(`✅ Found: ${vehicle.year} ${vehicle.make} ${vehicle.model || ''} - $${vehicle.price || '?'} - ${vehicle.mileage || '?'} mi`);
        vehicles.push(vehicle);
      }
    } catch (e) {
      // Invalid URL
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
  let searchStart = Math.max(0, linkPosition - 3000);
  let searchEnd = Math.min(html.length, linkPosition + 2000);

  const searchArea = html.substring(searchStart, searchEnd);
  const relativePosition = linkPosition - searchStart;

  for (const tag of containerTags) {
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
          break;
        }
      }
    }

    if (bestCard) {
      return bestCard;
    }
  }

  // Fallback: use a fixed window around the link
  const fallbackStart = Math.max(0, relativePosition - 1000);
  const fallbackEnd = Math.min(searchArea.length, relativePosition + 800);
  return searchArea.substring(fallbackStart, fallbackEnd);
}

/**
 * Find the matching closing tag for a given opening tag, properly handling nested tags
 */
function findMatchingClosingTag(html: string, openTagPos: number, tagName: string): number | null {
  const openPattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const closePattern = new RegExp(`</${tagName}>`, 'gi');

  let depth = 1;
  let searchPos = openTagPos + html.substring(openTagPos).indexOf('>') + 1;

  while (depth > 0 && searchPos < html.length) {
    openPattern.lastIndex = searchPos;
    closePattern.lastIndex = searchPos;

    const nextOpen = openPattern.exec(html);
    const nextClose = closePattern.exec(html);

    if (!nextClose) {
      return null;
    }

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      searchPos = openPattern.lastIndex;
    } else {
      depth--;
      searchPos = closePattern.lastIndex;

      if (depth === 0) {
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

  // Extract year
  const yearMatch = card.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    vehicle.year = parseInt(yearMatch[1]);
  }

  // Extract make with comprehensive brand list
  const makePattern = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda|Subaru|Kia|Hyundai|BMW|Mercedes|Mercedes-Benz|Audi|Lexus|Acura|Infiniti|Cadillac|Volkswagen|VW|Volvo|Porsche|Land Rover|Jaguar|Tesla|Buick|Chrysler|Lincoln|Genesis|Mitsubishi|Alfa Romeo|Bentley|Ferrari|Lamborghini|Maserati|McLaren|Rolls-Royce|Aston Martin)\b/i;
  const makeMatch = card.match(makePattern);
  if (makeMatch) {
    vehicle.make = makeMatch[1].replace('Chevy', 'Chevrolet');
  }

  // Extract model (word(s) after make)
  if (vehicle.make) {
    const modelPattern = new RegExp(
      `${vehicle.make}\\s+([A-Za-z0-9][A-Za-z0-9\\s\\-]{0,30}?)\\s*(?:\\$|\\d+\\s*(?:mi|miles)|<|\\||\\n)`,
      'i'
    );
    const modelMatch = card.match(modelPattern);
    if (modelMatch) {
      vehicle.model = modelMatch[1].trim();
    }
  }

  // Extract trim
  const trimPatterns = [
    /trim[:\s]+([A-Za-z0-9\s\-]+?)(?:<|\\||$)/i,
    /\b(LT|LS|LTZ|EX|EX-L|Sport|Limited|SE|SEL|SXT|Laramie|Big Horn|Denali|Premier|Platinum|XLT|STX|Lariat|King Ranch|Raptor|TRD|SR5)\b/,
  ];
  for (const pattern of trimPatterns) {
    const match = card.match(pattern);
    if (match && match[1]) {
      vehicle.trim = match[1].trim();
      break;
    }
  }

  // Extract price
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
        break;
      }
    }
  }

  // Extract mileage
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
        break;
      }
    }
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
    if (section.length < 200) continue;

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

    if ((vehicle.year && vehicle.make) || (vehicle.price && vehicle.url)) {
      vehicles.push(vehicle);
    }
  }

  return vehicles;
}
