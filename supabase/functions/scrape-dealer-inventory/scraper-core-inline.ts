// =====================================================
// UNIFIED SCRAPER CORE - INLINED FOR DEPLOYMENT
// =====================================================
// This file consolidates all shared code for Supabase Edge Functions
// which don't support importing from parent directories

// =====================================================
// TYPES
// =====================================================

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

export interface VINDecodedData {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  engineType?: string;
  driveType?: string;
}

export interface ScraperConfig {
  maxConcurrency: number;
  pageDelay: number;
  maxPages: number;
  timeout: number;
  userAgent: string;
}

const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxConcurrency: 5,
  pageDelay: 800,
  maxPages: 20,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
};

// =====================================================
// URL NORMALIZATION
// =====================================================

function normalizeUrl(url: string): string {
  if (!url) throw new Error('URL cannot be empty');

  url = url.trim();
  if (!url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }
  url = url.replace(/^http:\/\//, 'https://');

  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return `${parsed.protocol}//${hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    const base = normalizeUrl(baseUrl);
    return new URL(relativeUrl, base).href;
  } catch (error) {
    throw new Error(`Failed to resolve URL: ${relativeUrl} against ${baseUrl}`);
  }
}

function getBaseUrl(url: string): string {
  const normalized = normalizeUrl(url);
  const parsed = new URL(normalized);
  return `${parsed.protocol}//${parsed.hostname}`;
}

// =====================================================
// VIN DECODER
// =====================================================

async function decodeVIN(vin: string): Promise<VINDecodedData | null> {
  if (!vin || vin.length !== 17) {
    console.log(`⚠️ Invalid VIN format: ${vin}`);
    return null;
  }

  try {
    console.log(`🔍 Decoding VIN via NHTSA API: ${vin}`);
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`❌ NHTSA API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.Results || !Array.isArray(data.Results)) {
      console.log(`❌ Unexpected NHTSA API response format`);
      return null;
    }

    const results = data.Results;
    const getValueByName = (name: string) => results.find((r: any) => r.Variable === name)?.Value;

    const yearStr = getValueByName('Model Year');
    const make = getValueByName('Make');
    const model = getValueByName('Model');
    const trim = getValueByName('Trim');

    const decoded: VINDecodedData = {
      vin,
      year: yearStr ? parseInt(yearStr) : undefined,
      make: make || undefined,
      model: model || undefined,
      trim: trim || undefined,
    };

    if (!decoded.year && !decoded.make && !decoded.model) {
      console.log(`⚠️ VIN decoded but no useful data found for ${vin}`);
      return null;
    }

    console.log(`✅ VIN decoded: ${decoded.year} ${decoded.make} ${decoded.model}`);
    return decoded;
  } catch (error) {
    console.log(`❌ Error decoding VIN ${vin}: ${(error as Error).message}`);
    return null;
  }
}

function toTitleCase(str: string): string {
  if (!str) return str;
  const words = str.split(/(\s+|-)/);
  return words.map(word => {
    if (word === ' ' || word === '-' || word.trim() === '') return word;
    if (/^[A-Z0-9]+$/i.test(word) && /[A-Z]/i.test(word) && /[0-9]/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

async function enrichVehicleWithVIN(vehicle: ParsedVehicle): Promise<ParsedVehicle> {
  if (!vehicle.vin || vehicle.vin.length !== 17) return vehicle;
  if (vehicle.year && vehicle.make && vehicle.model) return vehicle;

  console.log(`Vehicle ${vehicle.vin} missing data - attempting VIN decode...`);
  const decoded = await decodeVIN(vehicle.vin);
  if (!decoded) return vehicle;

  return {
    ...vehicle,
    year: vehicle.year || decoded.year,
    make: vehicle.make || (decoded.make ? toTitleCase(decoded.make) : undefined),
    model: vehicle.model || (decoded.model ? toTitleCase(decoded.model) : undefined),
    trim: vehicle.trim || decoded.trim,
  };
}

// =====================================================
// HTML PARSER
// =====================================================

export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
  console.log('🔍 Starting unified inventory parsing...');

  const parsers = [
    parseStructuredData,
    parseVehicleCards,
    parseGenericSections,
  ];

  for (const parser of parsers) {
    try {
      const vehicles = parser(html, baseUrl);
      if (vehicles.length > 0) {
        console.log(`✅ Parser found ${vehicles.length} vehicles`);
        const validVehicles = vehicles.filter(v =>
          (v.vin && v.vin.length === 17) || (v.year && v.make) || v.url || (v.price && v.year)
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
            if (vehicle.year || vehicle.make) vehicles.push(vehicle);
          }
        }
      } catch (e) {
        // Invalid JSON
      }
    }
  } catch (e) {
    // Parsing error
  }
  return vehicles;
}

function parseVehicleCards(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();

  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  const matches = [...html.matchAll(linkRegex)];

  for (const match of matches) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();

    const hasYear = /\b(19|20)\d{2}\b/.test(linkText);
    const hasMake = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i.test(linkText);

    const lowerHref = href.toLowerCase();
    const isVehicleUrl = lowerHref.includes('/vehicle') || lowerHref.includes('/inventory/') ||
      lowerHref.includes('/cars/') || lowerHref.includes('/used-') || lowerHref.includes('-for-sale') ||
      lowerHref.includes('/detail') || /\/\d+/.test(href);

    if ((!hasYear && !hasMake && !isVehicleUrl) || lowerHref.includes('/search') ||
        lowerHref === '/' || href.startsWith('#')) continue;

    try {
      const fullUrl = resolveUrl(href, baseUrl);
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const card = findContainingCard(html, match.index!);
      if (!card) continue;

      const vehicle = parseVehicleFromCard(card, linkText, fullUrl, baseUrl);
      const hasVIN = vehicle.vin && vehicle.vin.length === 17;
      const hasYearAndMake = vehicle.year && vehicle.make;
      const hasPriceAndYear = vehicle.price && vehicle.year;

      if (hasVIN || hasYearAndMake || hasPriceAndYear) vehicles.push(vehicle);
    } catch (e) {
      continue;
    }
  }

  return vehicles;
}

function findContainingCard(html: string, linkPosition: number): string | null {
  const containerTags = ['div', 'article', 'li', 'section'];
  const searchStart = Math.max(0, linkPosition - 3000);
  const searchEnd = Math.min(html.length, linkPosition + 2000);
  const searchArea = html.substring(searchStart, searchEnd);
  const relativePosition = linkPosition - searchStart;

  for (const tag of containerTags) {
    const openPattern = new RegExp(`<${tag}[^>]*>`, 'gi');
    const before = searchArea.substring(0, relativePosition);
    const openMatches = [...before.matchAll(openPattern)];

    for (let i = openMatches.length - 1; i >= 0; i--) {
      const openPos = openMatches[i].index!;
      const closePos = findMatchingClosingTag(searchArea, openPos, tag);

      if (closePos !== null && closePos > relativePosition) {
        const card = searchArea.substring(openPos, closePos);
        const hasVehicleContent = /\b(19|20)\d{2}\b/.test(card) || /\$[\d,]+/.test(card) ||
          /\d+\s*(?:mi|miles|km)/i.test(card);
        if (hasVehicleContent) return card;
      }
    }
  }

  const fallbackStart = Math.max(0, relativePosition - 1000);
  const fallbackEnd = Math.min(searchArea.length, relativePosition + 800);
  return searchArea.substring(fallbackStart, fallbackEnd);
}

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

    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      searchPos = openPattern.lastIndex;
    } else {
      depth--;
      searchPos = closePattern.lastIndex;
      if (depth === 0) return searchPos;
    }
  }
  return null;
}

function parseVehicleFromCard(card: string, linkText: string, url: string, baseUrl: string): ParsedVehicle {
  const vehicle: ParsedVehicle = { url };

  // VIN
  const vinPatterns = [/VIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b/i, /\b([A-HJ-NPR-Z0-9]{17})\b/];
  for (const pattern of vinPatterns) {
    const match = card.match(pattern);
    if (match) {
      vehicle.vin = match[1].toUpperCase();
      break;
    }
  }

  // Stock
  const stockPatterns = [/stock[#\s]*:?\s*([A-Z0-9\-]+)/i, /#([A-Z0-9\-]{3,})/];
  for (const pattern of stockPatterns) {
    const match = card.match(pattern);
    if (match) {
      vehicle.stock_number = match[1];
      break;
    }
  }

  // Year
  const yearMatch = card.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) vehicle.year = parseInt(yearMatch[1]);

  // Make
  const makePattern = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chevy|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|VW|Volvo)\b/i;
  const makeMatch = card.match(makePattern);
  if (makeMatch) {
    let make = makeMatch[1]
      .replace(/Chevy/i, 'Chevrolet')
      .replace(/VW/i, 'Volkswagen')
      .replace(/^Mercedes$/i, 'Mercedes-Benz');
    vehicle.make = toTitleCase(make);
  }

  // Model
  if (vehicle.make) {
    const modelPattern = new RegExp(
      `${vehicle.make}\\s+([A-Za-z0-9][A-Za-z0-9\\s\\-]{0,30}?)\\s*(?:\\$|\\d+\\s*(?:mi|miles)|<|\\||\\n)`, 'i'
    );
    const modelMatch = card.match(modelPattern);
    if (modelMatch) vehicle.model = toTitleCase(modelMatch[1].trim());
  }

  // Price
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

  // Mileage
  const mileagePatterns = [/([\d,]+)\s*(?:mi|miles)\b/i, /mileage[:\s]+([\d,]+)/i];
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

function parseGenericSections(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];
  const sections = html.split(/(?=<(?:div|article|li|section))/i);

  for (const section of sections) {
    if (section.length < 200) continue;
    const hasVehicleKeywords = /\b(19|20)\d{2}\b/.test(section) &&
      /\b(Acura|Ford|Chevrolet|Toyota|Honda|Nissan|Jeep|RAM|Dodge|GMC|Mazda)\b/i.test(section);
    if (!hasVehicleKeywords) continue;

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

    if (hasVIN || hasYearAndMake || hasPriceAndYear) vehicles.push(vehicle);
  }

  return vehicles;
}

// =====================================================
// SCRAPER CORE
// =====================================================

export async function scrapeWebsite(
  url: string,
  config?: Partial<ScraperConfig>
): Promise<ParsedVehicle[]> {
  const startTime = Date.now();
  const finalConfig: ScraperConfig = { ...DEFAULT_SCRAPER_CONFIG, ...config };

  console.log(`🚀 Starting scrape of ${url}`);

  try {
    const normalizedUrl = normalizeUrl(url);
    console.log(`✅ Normalized URL: ${normalizedUrl}`);

    const inventoryUrls = await discoverInventoryPages(normalizedUrl, finalConfig);
    console.log(`📄 Found ${inventoryUrls.length} inventory URL(s)`);

    const allVehicles = await fetchAllInventoryPages(inventoryUrls, finalConfig);
    console.log(`🚗 Found ${allVehicles.length} total vehicles`);

    const detailedVehicles = await fetchDetailPages(allVehicles, finalConfig);
    console.log(`✅ Fetched ${detailedVehicles.length} detail pages`);

    const enrichedVehicles = await enrichVehicles(detailedVehicles);
    const duration = Date.now() - startTime;
    console.log(`✅ Complete in ${(duration / 1000).toFixed(1)}s - Found ${enrichedVehicles.length} vehicles`);

    return enrichedVehicles;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Scraping failed after ${(duration / 1000).toFixed(1)}s:`, error);
    throw error;
  }
}

async function discoverInventoryPages(baseUrl: string, config: ScraperConfig): Promise<string[]> {
  const urls = new Set<string>();
  const baseUrlOnly = getBaseUrl(baseUrl);
  const inventoryPaths = ['/inventory', '/used-cars', '/vehicles', '/cars', '/used-inventory',
    '/pre-owned', '/search', '/stock', '/inventory.html', ''];

  for (const path of inventoryPaths) {
    urls.add(`${baseUrlOnly}${path}`);
  }

  const validUrls: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': config.userAgent },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        validUrls.push(url);
        console.log(`✓ Valid inventory URL: ${url}`);
      }
    } catch {
      // URL not accessible
    }
  }

  if (validUrls.length === 0) validUrls.push(baseUrl);
  return validUrls;
}

async function fetchAllInventoryPages(inventoryUrls: string[], config: ScraperConfig): Promise<ParsedVehicle[]> {
  const allVehicles: ParsedVehicle[] = [];
  const seenUrls = new Set<string>();

  for (const inventoryUrl of inventoryUrls) {
    console.log(`📄 Fetching inventory from: ${inventoryUrl}`);
    try {
      let currentPage = 1;
      let html = await fetchPage(inventoryUrl, config).then(r => r.text());
      let vehicles = parseInventoryHTML(html, inventoryUrl);

      vehicles.forEach(v => {
        if (v.url && !seenUrls.has(v.url)) {
          seenUrls.add(v.url);
          allVehicles.push(v);
        }
      });

      console.log(`📄 Page ${currentPage}: Found ${vehicles.length} vehicles (${allVehicles.length} total)`);

      while (currentPage < config.maxPages) {
        const nextPageUrl = findNextPageUrl(html, inventoryUrl, currentPage);
        if (!nextPageUrl) {
          console.log(`✅ No more pages`);
          break;
        }

        console.log(`📄 Fetching page ${currentPage + 1}: ${nextPageUrl}`);
        try {
          html = await fetchPage(nextPageUrl, config).then(r => r.text());
          vehicles = parseInventoryHTML(html, nextPageUrl);

          let newVehicles = 0;
          vehicles.forEach(v => {
            if (v.url && !seenUrls.has(v.url)) {
              seenUrls.add(v.url);
              allVehicles.push(v);
              newVehicles++;
            }
          });

          console.log(`📄 Page ${currentPage + 1}: ${vehicles.length} vehicles (${newVehicles} new, ${allVehicles.length} total)`);
          if (newVehicles === 0) break;

          currentPage++;
          await new Promise(resolve => setTimeout(resolve, config.pageDelay));
        } catch (error) {
          console.error(`Failed to fetch page ${currentPage + 1}`);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${inventoryUrl}`);
      continue;
    }
  }

  return allVehicles;
}

function findNextPageUrl(html: string, baseUrl: string, currentPage: number): string | null {
  const nextPage = currentPage + 1;
  const pagePatterns = [
    new RegExp(`<a[^>]*href=["']([^"']*[?&]page=${nextPage}[^"']*)["']`, 'i'),
    new RegExp(`<a[^>]*href=["']([^"']*/page/${nextPage}[^"']*)["']`, 'i'),
  ];

  for (const pattern of pagePatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return resolveUrl(match[1], baseUrl);
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function fetchDetailPages(vehicles: ParsedVehicle[], config: ScraperConfig): Promise<ParsedVehicle[]> {
  const detailed: ParsedVehicle[] = [];
  let successCount = 0;

  console.log(`📊 Fetching details for ${vehicles.length} vehicles...`);

  for (let i = 0; i < vehicles.length; i += config.maxConcurrency) {
    const batch = vehicles.slice(i, i + config.maxConcurrency);
    const promises = batch.map(async (vehicle) => {
      if (!vehicle.url) return vehicle;
      try {
        const response = await fetchPage(vehicle.url, config);
        const html = await response.text();
        const parsed = parseInventoryHTML(html, vehicle.url);
        const merged = parsed.length > 0 ? { ...vehicle, ...parsed[0] } : vehicle;
        successCount++;
        return merged;
      } catch (error) {
        return vehicle;
      }
    });

    const results = await Promise.all(promises);
    detailed.push(...results);

    if (i + config.maxConcurrency < vehicles.length) {
      await new Promise(resolve => setTimeout(resolve, config.pageDelay));
    }
  }

  console.log(`✅ Completed: ${successCount}/${vehicles.length} detail pages fetched`);
  return detailed;
}

async function enrichVehicles(vehicles: ParsedVehicle[]): Promise<ParsedVehicle[]> {
  const enriched: ParsedVehicle[] = [];
  for (const vehicle of vehicles) {
    const enrichedVehicle = await enrichVehicleWithVIN(vehicle);
    enriched.push(enrichedVehicle);
  }
  return enriched;
}

async function fetchPage(url: string, config: ScraperConfig): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response;
}
