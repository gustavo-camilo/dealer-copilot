// =====================================================
// UNIFIED HTML PARSER FOR DEALER WEBSITES
// =====================================================
// Merges logic from both dealer-inventory and competitor parsers
// Uses the best strategies from each to maximize vehicle extraction

import type { ParsedVehicle } from './types.ts';
import { resolveUrl } from './url-normalizer.ts';

/**
 * Main parsing function with robust vehicle card extraction
 * Tries multiple strategies in order of reliability
 */
export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  console.log('🔍 Starting unified inventory parsing...');

  // Try different strategies in order
  const parsers = [
    parseStructuredData, // JSON-LD (most reliable)
    parseVehicleCards, // Container-based extraction (most common)
    parseGenericSections, // Fallback for unusual structures
  ];

  for (const parser of parsers) {
    try {
      const vehicles = parser(html, baseUrl);
      if (vehicles.length > 0) {
        console.log(`✅ Parser found ${vehicles.length} vehicles`);

        // Validate vehicles have minimum required data
        const validVehicles = vehicles.filter((v) =>
          (v.vin && v.vin.length === 17) || // Has valid VIN
          (v.year && v.make) || // Has year and make
          v.url || // Has URL (can fetch details later)
          (v.price && v.year) // Has price and year
        );

        if (validVehicles.length > 0) {
          console.log(`✅ ${validVehicles.length} valid vehicles after filtering`);
          return validVehicles;
        }
      }
    } catch (error) {
      console.log(`❌ Parser failed: ${(error as Error).message}`);
    }
  }

  console.warn('⚠️ No vehicles found with any parser');
  return [];
}

/**
 * Strategy 1: Parse JSON-LD structured data
 * Most reliable when available - dealers using modern platforms often include this
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
              url: item.url ? resolveUrl(item.url, baseUrl) : undefined,
              images: item.image ? (Array.isArray(item.image) ? [item.image[0]] : [item.image]) : [],
            };

            if (vehicle.year || vehicle.make) {
              vehicles.push(vehicle);
            }
          }
        }
      } catch (e) {
        // Invalid JSON, continue to next match
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
 * This is the most common strategy and works for 80%+ of dealer websites
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

    // Check if link text or URL suggests it's a vehicle
    const hasYear = /\b(19|20)\d{2}\b/.test(linkText);
    const hasMake =
      /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i.test(
        linkText
      );

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

    // Skip non-vehicle links
    if ((!hasYear && !hasMake && !isVehicleUrl) || lowerHref.includes('/search') || lowerHref === '/' || href.startsWith('#')) {
      continue;
    }

    try {
      const fullUrl = resolveUrl(href, baseUrl);

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

      // Accept vehicle if it has enough identifying information
      const hasVIN = vehicle.vin && vehicle.vin.length === 17;
      const hasYearAndMake = vehicle.year && vehicle.make;
      const hasPriceAndYear = vehicle.price && vehicle.year;

      if (hasVIN || hasYearAndMake || hasPriceAndYear) {
        vehicles.push(vehicle);
      }
    } catch (e) {
      // Invalid URL, continue
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
  const searchStart = Math.max(0, linkPosition - 3000);
  const searchEnd = Math.min(html.length, linkPosition + 2000);

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
 * This is where the actual data extraction happens
 */
function parseVehicleFromCard(card: string, linkText: string, url: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = { url };

  // Extract VIN
  const vinPatterns = [
    /VIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i,
    /vehicle identification number[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i,
    /\b([A-HJ-NPR-Z0-9]{17})\b/,
  ];
  for (const pattern of vinPatterns) {
    const vinMatch = card.match(pattern);
    if (vinMatch) {
      vehicle.vin = vinMatch[1].toUpperCase();
      break;
    }
  }

  // Extract stock number
  const stockPatterns = [/stock[#\s]*:?\s*([A-Z0-9\-]+)/i, /stock number[#\s]*:?\s*([A-Z0-9\-]+)/i, /#([A-Z0-9\-]{3,})/];
  for (const pattern of stockPatterns) {
    const match = card.match(pattern);
    if (match) {
      vehicle.stock_number = match[1];
      break;
    }
  }

  // Extract year
  const yearMatch = card.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    vehicle.year = parseInt(yearMatch[1]);
  }

  // Extract make
  const makePattern =
    /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i;
  const makeMatch = card.match(makePattern);
  if (makeMatch) {
    let make = makeMatch[1]
      .replace(/Chevy/i, 'Chevrolet')
      .replace(/VW/i, 'Volkswagen')
      .replace(/Mercedes-Benz/i, 'Mercedes-Benz')
      .replace(/^Mercedes$/i, 'Mercedes-Benz');
    vehicle.make = toTitleCase(make);
  }

  // Extract model
  if (vehicle.make) {
    const modelPattern = new RegExp(
      `${vehicle.make}\\s+([A-Za-z0-9][A-Za-z0-9\\s\\-]{0,30}?)\\s*(?:\\$|\\d+\\s*(?:mi|miles)|<|\\||\\n)`,
      'i'
    );
    const modelMatch = card.match(modelPattern);
    if (modelMatch) {
      vehicle.model = toTitleCase(modelMatch[1].trim());
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
  const pricePatterns = [/\$\s*([\d,]+)\b/, /price[:\s]+\$?\s*([\d,]+)/i];
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
  const mileagePatterns = [/([\d,]+)\s*(?:mi|miles)\b/i, /mileage[:\s]+([\d,]+)/i, /odometer[:\s]+([\d,]+)/i];
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

  // Extract color
  const colorPatterns = [
    /color[:\s]+([A-Za-z\s]+?)(?:<|\\||$)/i,
    /\b(Black|White|Silver|Gray|Grey|Red|Blue|Green|Yellow|Orange|Brown|Tan|Beige)\b/i,
  ];
  for (const pattern of colorPatterns) {
    const match = card.match(pattern);
    if (match && match[1]) {
      vehicle.color = match[1].trim();
      break;
    }
  }

  // Extract first good image from THIS CARD ONLY
  const images = extractFirstGoodImage(card, baseUrl);
  if (images.length > 0) {
    vehicle.images = images;
    vehicle.imageDate = extractDateFromImageFilename(images[0]);
  }

  return vehicle;
}

/**
 * Strategy 3: Generic section parsing (fallback)
 * Used when vehicle cards can't be properly identified
 */
function parseGenericSections(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Split by common container tags
  const sections = html.split(/(?=<(?:div|article|li|section))/i);

  for (const section of sections) {
    if (section.length < 200) continue;

    const hasVehicleKeywords =
      /\b(19|20)\d{2}\b/.test(section) && // Has year
      /\b(Acura|Alfa Romeo|Aston Martin|Audi|BMW|Buick|Cadillac|Chevrolet|Chrysler|Dodge|Ferrari|Ford|GMC|Honda|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lexus|Lincoln|Mazda|Mercedes|Mitsubishi|Nissan|Porsche|RAM|Subaru|Tesla|Toyota|Volkswagen|Volvo)\b/i.test(
        section
      );

    if (!hasVehicleKeywords) continue;

    // Find URL in this section
    const urlMatch = section.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    let url = '';
    if (urlMatch) {
      try {
        url = resolveUrl(urlMatch[1], baseUrl);
      } catch {
        continue;
      }
    }

    const vehicle = parseVehicleFromCard(section, '', url, baseUrl);

    const hasVIN = vehicle.vin && vehicle.vin.length === 17;
    const hasYearAndMake = vehicle.year && vehicle.make;
    const hasPriceAndYear = vehicle.price && vehicle.year;

    if (hasVIN || hasYearAndMake || hasPriceAndYear) {
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
      (lowerSrc.includes('thumbnail') && lowerSrc.includes('user')) ||
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
      const url = resolveUrl(imgSrc, baseUrl);
      return [url];
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
  const patterns = [/IMG[-_](\d{4})(\d{2})(\d{2})/i, /photo[-_](\d{4})(\d{2})(\d{2})/i, /(\d{4})(\d{2})(\d{2})/];

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

/**
 * Title case helper
 */
function toTitleCase(str: string): string {
  if (!str) return str;

  const words = str.split(/(\s+|-)/);

  return words
    .map((word) => {
      if (word === ' ' || word === '-' || word.trim() === '') {
        return word;
      }

      if (/^[A-Z0-9]+$/i.test(word)) {
        if (/[A-Z]/i.test(word) && /[0-9]/.test(word)) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}
