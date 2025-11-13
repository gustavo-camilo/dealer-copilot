// =====================================================
// MULTI-SOURCE METADATA EXTRACTOR
// =====================================================
// Extracts vehicle data from multiple HTML sources:
// 1. Meta tags (og:, twitter:, etc.)
// 2. Schema.org / JSON-LD
// 3. Microdata
// 4. Title tag patterns
// 5. Custom data attributes

export interface ExtractedMetadata {
  title?: string;
  description?: string;
  image?: string;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: number;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];  // Track where data came from
}

/**
 * Extract meta tags from HTML
 */
function extractMetaTags(html: string): Map<string, string> {
  const meta = new Map<string, string>();

  // Match all meta tags
  const metaRegex = /<meta\s+([^>]+)>/gi;
  const matches = [...html.matchAll(metaRegex)];

  for (const match of matches) {
    const attrs = match[1];

    // Extract property/name and content
    const propMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i);

    if (propMatch && contentMatch) {
      const key = propMatch[1].toLowerCase();
      const value = contentMatch[1];
      meta.set(key, value);
    }
  }

  return meta;
}

/**
 * Extract Open Graph data
 */
function extractOpenGraph(metaTags: Map<string, string>): Partial<ExtractedMetadata> {
  const og: Partial<ExtractedMetadata> = { sources: [] };

  // Title
  if (metaTags.has('og:title')) {
    og.title = metaTags.get('og:title');
    og.sources?.push('og:title');
  }

  // Description
  if (metaTags.has('og:description')) {
    og.description = metaTags.get('og:description');
    og.sources?.push('og:description');
  }

  // Image
  if (metaTags.has('og:image')) {
    og.image = metaTags.get('og:image');
    og.sources?.push('og:image');
  }

  // Price (if available)
  if (metaTags.has('og:price:amount')) {
    const price = parseFloat(metaTags.get('og:price:amount')!);
    if (!isNaN(price)) {
      og.price = price;
      og.sources?.push('og:price:amount');
    }
  }

  return og;
}

/**
 * Extract Twitter Card data
 */
function extractTwitterCard(metaTags: Map<string, string>): Partial<ExtractedMetadata> {
  const twitter: Partial<ExtractedMetadata> = { sources: [] };

  // Title
  if (metaTags.has('twitter:title')) {
    twitter.title = metaTags.get('twitter:title');
    twitter.sources?.push('twitter:title');
  }

  // Description
  if (metaTags.has('twitter:description')) {
    twitter.description = metaTags.get('twitter:description');
    twitter.sources?.push('twitter:description');
  }

  // Image
  if (metaTags.has('twitter:image')) {
    twitter.image = metaTags.get('twitter:image');
    twitter.sources?.push('twitter:image');
  }

  return twitter;
}

/**
 * Extract vehicle data from title/description
 */
function extractFromText(text: string): Partial<ExtractedMetadata> {
  const data: Partial<ExtractedMetadata> = { sources: [] };

  // Extract year (4 digits starting with 19 or 20)
  const yearMatch = text.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (yearMatch) {
    data.year = parseInt(yearMatch[1]);
    data.sources?.push('text:year');
  }

  // Extract make
  const makePattern = /\b(Acura|Alfa Romeo|Aston Martin|Audi|Bentley|BMW|Buick|Cadillac|Chevrolet|Chrysler|Dodge|Ferrari|Fiat|Ford|Genesis|GMC|Honda|Hummer|Hyundai|Infiniti|Jaguar|Jeep|Kia|Lamborghini|Land Rover|Lexus|Lincoln|Lotus|Maserati|Mazda|McLaren|Mercedes-Benz|Mercedes|Mini|Mitsubishi|Nissan|Polestar|Porsche|RAM|Rivian|Rolls-Royce|Saab|Saturn|Scion|Smart|Subaru|Suzuki|Tesla|Toyota|Volkswagen|Volvo)\b/i;
  const makeMatch = text.match(makePattern);
  if (makeMatch) {
    data.make = makeMatch[1]
      .replace(/Chevrolet/i, 'Chevrolet')
      .replace(/Mercedes-Benz/i, 'Mercedes-Benz');
    data.sources?.push('text:make');
  }

  // Extract model (word after make)
  if (data.make && makeMatch) {
    const afterMake = text.substring(makeMatch.index! + makeMatch[0].length);
    const modelMatch = afterMake.match(/^\s+([A-Za-z0-9][A-Za-z0-9\s\-]{0,30}?)(?:\s|$|\||,)/);
    if (modelMatch) {
      data.model = modelMatch[1].trim();
      data.sources?.push('text:model');
    }
  }

  // Extract price
  const priceMatch = text.match(/\$\s*([\d,]+)/);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price >= 1000 && price <= 500000) {
      data.price = price;
      data.sources?.push('text:price');
    }
  }

  // Extract mileage
  // Note: Support both comma (123,456) and dot (123.456) as thousands separators
  const mileageMatch = text.match(/([\d,.]+)\s*(?:mi|miles|km)\b/i);
  if (mileageMatch) {
    const mileage = parseInt(mileageMatch[1].replace(/[,.]/g, ''));
    if (mileage >= 0 && mileage <= 500000) {
      data.mileage = mileage;
      data.sources?.push('text:mileage');
    }
  }

  // Extract VIN
  const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinMatch) {
    data.vin = vinMatch[1].toUpperCase();
    data.sources?.push('text:vin');
  }

  return data;
}

/**
 * Extract title tag
 */
function extractTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return titleMatch ? titleMatch[1].trim() : undefined;
}

/**
 * Main extraction function - combines all sources
 */
export function extractMetadata(html: string): ExtractedMetadata {
  const metaTags = extractMetaTags(html);

  // Extract from different sources
  const ogData = extractOpenGraph(metaTags);
  const twitterData = extractTwitterCard(metaTags);

  // Get title
  const titleTag = extractTitle(html);

  // Merge title from different sources (priority: OG > Twitter > title tag)
  const title = ogData.title || twitterData.title || titleTag;

  // Extract description
  const description = ogData.description ||
                     twitterData.description ||
                     metaTags.get('description');

  // Extract vehicle data from title
  const titleData = title ? extractFromText(title) : {};

  // Extract vehicle data from description
  const descData = description ? extractFromText(description) : {};

  // Merge all data (priority: specific meta tags > title > description)
  const merged: ExtractedMetadata = {
    title,
    description,
    image: ogData.image || twitterData.image,
    year: titleData.year || descData.year,
    make: titleData.make || descData.make,
    model: titleData.model || descData.model,
    price: ogData.price || titleData.price || descData.price,
    mileage: titleData.mileage || descData.mileage,
    vin: titleData.vin || descData.vin,
    confidence: 'low',
    sources: [
      ...(ogData.sources || []),
      ...(twitterData.sources || []),
      ...(titleData.sources || []),
      ...(descData.sources || []),
    ],
  };

  // Calculate confidence based on data sources
  const sourceCount = merged.sources.length;
  const hasStructuredData = merged.sources.some(s => s.startsWith('og:') || s.startsWith('twitter:'));

  if (hasStructuredData && sourceCount >= 4) {
    merged.confidence = 'high';
  } else if (sourceCount >= 3 || hasStructuredData) {
    merged.confidence = 'medium';
  } else {
    merged.confidence = 'low';
  }

  return merged;
}

/**
 * Merge metadata with existing vehicle data (prefer existing data)
 */
export function mergeWithMetadata(
  vehicle: any,
  metadata: ExtractedMetadata
): any {
  return {
    ...vehicle,
    // Only use metadata if vehicle data is missing
    year: vehicle.year || metadata.year,
    make: vehicle.make || metadata.make,
    model: vehicle.model || metadata.model,
    price: vehicle.price || metadata.price,
    mileage: vehicle.mileage || metadata.mileage,
    vin: vehicle.vin || metadata.vin,
    // Add image if not present
    images: vehicle.images && vehicle.images.length > 0
      ? vehicle.images
      : metadata.image
        ? [metadata.image]
        : [],
    // Track metadata confidence
    _metadataConfidence: metadata.confidence,
    _metadataSources: metadata.sources,
  };
}
