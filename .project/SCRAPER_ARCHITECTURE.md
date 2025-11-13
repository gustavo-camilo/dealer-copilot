# Dealer Co-Pilot Scraper Architecture

## Overview

This document describes the unified scraper architecture for Dealer Co-Pilot. The scraper is used for two purposes:

1. **Dealer Inventory Scraper**: Tracks the dealer's own inventory to detect sold vehicles and build sales history
2. **Competitor Scraper**: Analyzes competitor inventory to provide market intelligence

## Current Status

- **Phase 1**: ✅ Unified scraper core (IN PROGRESS)
- **Phase 2**: 📅 Intelligent caching (PLANNED)
- **Phase 3**: 📅 Enterprise detailed competitor tracking (FUTURE)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED SCRAPER CORE                       │
│  (_shared/scraper-core.ts)                                  │
│                                                             │
│  1. URL Normalization                                       │
│     ├─ Handles: rpm-motors.us, www.rpm-motors.us,         │
│     │          https://rpm-motors.us, etc.                 │
│     └─ Outputs: Canonical URL                              │
│                                                             │
│  2. Multi-Page Discovery                                    │
│     ├─ Finds: /inventory, /vehicles, /used-cars, etc.     │
│     └─ Outputs: List of inventory URLs                     │
│                                                             │
│  3. Pagination Handling                                     │
│     ├─ Detects: page=2, /page/2, etc.                     │
│     └─ Outputs: All paginated pages                        │
│                                                             │
│  4. Vehicle Card Extraction                                 │
│     ├─ Parses: Listing pages for vehicle links            │
│     └─ Outputs: List of vehicle detail URLs                │
│                                                             │
│  5. Detail Page Fetching                                    │
│     ├─ Fetches: Individual vehicle pages                   │
│     ├─ Concurrency: 5 requests at a time                   │
│     ├─ Delay: 800ms between batches                        │
│     └─ Outputs: Detailed vehicle data                      │
│                                                             │
│  6. VIN Enrichment                                          │
│     ├─ Uses: NHTSA vPIC API                               │
│     ├─ Fills: Missing year/make/model from VIN            │
│     └─ Outputs: Complete vehicle records                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Returns: ParsedVehicle[]
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
        ▼                                        ▼
┌─────────────────────┐              ┌─────────────────────┐
│ COMPETITOR SCRAPER  │              │ DEALER INV SCRAPER  │
│ (scrape-competitor) │              │ (scrape-dealer-inv) │
├─────────────────────┤              ├─────────────────────┤
│                     │              │                     │
│ Input:              │              │ Input:              │
│ - Competitor URL    │              │ - Dealer website    │
│ - Tenant ID         │              │ - Tenant ID         │
│                     │              │                     │
│ Processing:         │              │ Processing:         │
│ - Call core scraper │              │ - Call core scraper │
│ - Calculate stats:  │              │ - Track vehicles:   │
│   • Total count     │              │   • New vehicles    │
│   • Avg/min/max $   │              │   • Price changes   │
│   • Avg/min/max mi  │              │   • Sold vehicles   │
│   • Top 5 makes     │              │   • Days in lot     │
│   • Portfolio value │              │                     │
│                     │              │                     │
│ Output:             │              │ Output:             │
│ - competitor_       │              │ - vehicle_history   │
│   snapshots         │              │ - sales_records     │
│ - competitor_scan_  │              │ - inventory_        │
│   history           │              │   snapshots         │
│                     │              │                     │
└─────────────────────┘              └─────────────────────┘
```

---

## Phase 1: Unified Scraper Core (Current)

### Goals

1. ✅ Both scrapers find the same number of vehicles (all 91 cars from rpm-motors.us)
2. ✅ Handle all URL variations (www, https, no protocol, etc.)
3. ✅ Single source of truth for scraping logic
4. ✅ No breaking changes to existing functionality
5. ✅ No database schema changes

### Components

#### 1. Scraper Core (`_shared/scraper-core.ts`)

**Main function:**
```typescript
export async function scrapeWebsite(
  url: string,
  config?: Partial<ScraperConfig>
): Promise<ParsedVehicle[]>
```

**Configuration:**
```typescript
interface ScraperConfig {
  maxConcurrency: number;    // Default: 5
  pageDelay: number;         // Default: 800ms
  maxPages: number;          // Default: 20
  timeout: number;           // Default: 30000ms
  userAgent: string;         // Default: DealerCopilotBot/1.0
}
```

**Process:**
1. Normalize URL
2. Discover inventory pages
3. Follow pagination links
4. Extract vehicle cards
5. Fetch detail pages (with concurrency control)
6. Enrich with VIN decoder
7. Return complete vehicle list

#### 2. URL Normalizer (`_shared/url-normalizer.ts`)

**Purpose:** Handle all URL format variations

**Input examples:**
- `rpm-motors.us`
- `www.rpm-motors.us`
- `https://rpm-motors.us`
- `http://www.rpm-motors.us`
- `rpm-motors.us/inventory`

**Output:** Canonical URL format
- `https://rpm-motors.us`

**Functions:**
```typescript
export function normalizeUrl(url: string): string;
export function isValidUrl(url: string): boolean;
```

#### 3. Unified Parser (`_shared/parser-unified.ts`)

**Purpose:** Single parsing logic used by both scrapers

**Strategies (tried in order):**
1. **JSON-LD structured data** (most reliable)
   - Looks for `<script type="application/ld+json">`
   - Parses Car/Vehicle schema

2. **Vehicle card extraction** (most common)
   - Finds vehicle detail links
   - Locates containing card/div
   - Extracts data from isolated container

3. **Generic section parsing** (fallback)
   - Splits HTML into sections
   - Looks for vehicle patterns

**Returns:**
```typescript
interface ParsedVehicle {
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
```

#### 4. VIN Decoder (`_shared/vin-decoder.ts`)

**Purpose:** Fill missing vehicle data using NHTSA API

**API:** https://vpic.nhtsa.dot.gov/api/

**Usage:**
```typescript
export async function decodeVIN(vin: string): Promise<VINDecodedData | null>;
export async function enrichVehicleWithVIN(vehicle: ParsedVehicle): Promise<ParsedVehicle>;
```

**Logic:**
- Only decodes if VIN exists and is 17 characters
- Only fills in missing fields (doesn't override existing data)
- Free API, no rate limits

### File Structure

**IMPORTANT: Supabase Edge Functions Deployment**

Supabase Edge Functions don't support importing from parent directories (like `../_shared/`). Therefore, we use an **inlined approach** where all shared code is bundled into each function.

```
supabase/functions/
├── _shared/                          (REFERENCE ONLY - not deployed)
│   ├── scraper-core.ts              (Main scraping logic - REFERENCE)
│   ├── parser-unified.ts            (Unified HTML parser - REFERENCE)
│   ├── url-normalizer.ts            (URL handling - REFERENCE)
│   ├── vin-decoder.ts               (VIN enrichment - REFERENCE)
│   └── types.ts                     (Shared interfaces - REFERENCE)
│
├── scrape-competitor/
│   ├── index.ts                     (✅ DEPLOYED - main function)
│   ├── scraper-core-inline.ts       (✅ DEPLOYED - all shared code inlined)
│   ├── parser.ts.backup             (BACKUP - old version)
│   └── vinDecoder.ts.backup         (BACKUP - old version)
│
└── scrape-dealer-inventory/
    ├── index.ts                     (✅ DEPLOYED - main function)
    ├── scraper-core-inline.ts       (✅ DEPLOYED - all shared code inlined)
    ├── dateExtractor.ts             (✅ DEPLOYED - dealer-specific logic)
    ├── parser.ts.backup             (BACKUP - old version)
    └── vinDecoder.ts.backup         (BACKUP - old version)
```

**Why Inlined Code?**
- ✅ Supabase Edge Functions deploy each function independently
- ✅ Cannot import from parent directories (`../_shared/`)
- ✅ Each function must be self-contained
- ✅ `scraper-core-inline.ts` contains ALL shared code in one file

**Maintaining Consistency:**
- The `_shared/` folder serves as **reference documentation**
- When updating scraper logic, update `scraper-core-inline.ts` in BOTH functions
- Keep both inline files identical to ensure consistent behavior

### Backward Compatibility

**No breaking changes:**
- ✅ Database schema unchanged
- ✅ API contracts unchanged
- ✅ Response formats unchanged
- ✅ RLS policies unchanged
- ✅ Triggers unchanged
- ✅ Frontend code unchanged

**Rollback plan:**
- Old code kept in same directory with `.backup` extension
- If issues arise, rename files back
- Zero downtime rollback

---

## Phase 2: Intelligent Caching (Planned)

### Goals

1. ✅ Reduce HTTP requests by 80%+
2. ✅ Improve scraping speed by 7-10x
3. ✅ Reduce server load
4. ✅ Prevent rate limiting/blocking
5. ✅ Better user experience (instant results)

### Cache Strategy

**Simple 24-hour snapshot caching:**

```typescript
// When scraping is requested:
1. Check if snapshot exists and is < 24 hours old
   → YES: Return cached data immediately (0.2 seconds)
   → NO: Perform full scrape (45 seconds)

2. After scraping, save to database
   → Acts as cache for next 24 hours
```

### Implementation Plan

#### 1. Add Cache Table

```sql
-- New table for detailed page caching
CREATE TABLE scrape_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  parsed_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

  CONSTRAINT expires_at_check CHECK (expires_at > cached_at)
);

-- Index for fast lookups
CREATE INDEX idx_scrape_cache_url ON scrape_cache(url);
CREATE INDEX idx_scrape_cache_expires ON scrape_cache(expires_at);

-- Auto-cleanup cron job
SELECT cron.schedule(
  'cleanup-stale-cache',
  '0 3 * * *',  -- 3 AM daily
  $$
  DELETE FROM scrape_cache WHERE expires_at < NOW();
  $$
);
```

#### 2. Update Scraper Core

```typescript
// Add caching layer to scraper core
export interface CacheOptions {
  enableCache: boolean;           // Default: true
  cacheDuration: number;          // Default: 24 hours
  forceRefresh: boolean;          // Default: false
}

export async function scrapeWebsite(
  url: string,
  config?: Partial<ScraperConfig>,
  cacheOptions?: Partial<CacheOptions>
): Promise<ParsedVehicle[]> {

  // 1. Check snapshot cache
  if (cacheOptions?.enableCache && !cacheOptions?.forceRefresh) {
    const cached = await getSnapshotFromCache(url);
    if (cached && isCacheFresh(cached, cacheOptions.cacheDuration)) {
      console.log('✅ Using cached snapshot');
      return cached.vehicles;
    }
  }

  // 2. Scrape with detail page caching
  const vehicles = await scrapeWithCache(url, config, cacheOptions);

  // 3. Save snapshot
  await saveSnapshotToCache(url, vehicles);

  return vehicles;
}

async function scrapeWithCache(
  url: string,
  config: ScraperConfig,
  cacheOptions: CacheOptions
): Promise<ParsedVehicle[]> {

  // Discover and fetch listing pages (not cached)
  const inventoryUrls = await discoverInventoryPages(url);
  const allVehicleLinks = await fetchAllListingPages(inventoryUrls);

  // Fetch detail pages WITH caching
  const vehicles = [];
  for (const link of allVehicleLinks) {

    // Check cache first
    if (cacheOptions.enableCache) {
      const cached = await getPageFromCache(link.url);
      if (cached && isCacheFresh(cached, cacheOptions.cacheDuration)) {
        vehicles.push(cached);
        continue;
      }
    }

    // Cache miss - fetch from web
    const vehicle = await fetchAndParseDetailPage(link.url);

    // Save to cache
    if (cacheOptions.enableCache) {
      await savePageToCache(link.url, vehicle);
    }

    vehicles.push(vehicle);
  }

  return vehicles;
}
```

#### 3. Update Both Scrapers

**Competitor Scraper:**
```typescript
// Enable caching by default
const vehicles = await scrapeWebsite(url, {
  maxConcurrency: 5,
  pageDelay: 800
}, {
  enableCache: true,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  forceRefresh: false
});
```

**Dealer Inventory Scraper:**
```typescript
// Enable caching by default
const vehicles = await scrapeWebsite(url, {
  maxConcurrency: 5,
  pageDelay: 800
}, {
  enableCache: true,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  forceRefresh: false
});
```

#### 4. Configuration File

```typescript
// _shared/cache-config.ts
export const CACHE_CONFIG = {
  // Enable/disable caching globally
  ENABLE_CACHE: true,

  // Cache duration (24 hours)
  CACHE_DURATION_MS: 24 * 60 * 60 * 1000,

  // Cleanup old cache entries daily at 3 AM
  CLEANUP_SCHEDULE: '0 3 * * *',

  // Maximum cache size (delete oldest if exceeded)
  MAX_CACHE_ENTRIES: 10000,

  // For debugging: disable cache
  DEBUG_DISABLE_CACHE: false
};
```

### Performance Metrics

| Metric | Before Cache | After Cache | Improvement |
|--------|-------------|-------------|-------------|
| User refresh (same day) | 45 sec | 0.2 sec | **225x faster** |
| Daily automated scrape | 1.9 hours | 15 min | **7.6x faster** |
| HTTP requests/day | 27,300 | ~5,000 | **81% reduction** |
| Risk of blocking | HIGH | LOW | Much safer |
| Database storage | 0 MB | ~50 MB | Acceptable |

### Cache Behavior Examples

#### Example 1: First Scan
```
9:00 AM - User scans competitor (first time)
          → Cache: MISS (no data)
          → Full scrape: 91 vehicles, 45 seconds
          → Saves to cache (expires in 24 hours)
```

#### Example 2: Same Day Refresh
```
9:00 AM - Initial scan (45 seconds)
2:00 PM - User clicks refresh
          → Cache: HIT (5 hours old)
          → Returns cached data: 0.2 seconds
          → UI shows: "Last updated 5 hours ago"
```

#### Example 3: Daily Cron Job
```
2:00 AM - Automated scrape runs
          → Checks cache for each competitor
          → Most detail pages cached from yesterday
          → Only fetches changed/new vehicles
          → Completes in 15 minutes instead of 1.9 hours
```

#### Example 4: Cache Expiry
```
Day 1, 9:00 AM - Initial scan
Day 2, 8:00 AM - User refreshes (23 hours later)
                 → Cache: HIT (still valid)
Day 2, 10:00 AM - User refreshes (25 hours later)
                  → Cache: MISS (expired)
                  → Full scrape: 45 seconds
                  → New cache for next 24 hours
```

### Monitoring & Debugging

**Cache hit rate tracking:**
```typescript
// Add to scraper logs
console.log('Cache statistics:');
console.log(`- Total requests: ${totalRequests}`);
console.log(`- Cache hits: ${cacheHits}`);
console.log(`- Cache misses: ${cacheMisses}`);
console.log(`- Hit rate: ${(cacheHits / totalRequests * 100).toFixed(1)}%`);
```

**Expected cache hit rates:**
- First scrape of the day: 0% (all misses)
- Subsequent scrapes: 90-95% (most vehicles unchanged)
- After 24 hours: 0% (cache expired)

### Rollback Plan

If caching causes issues:
1. Set `CACHE_CONFIG.ENABLE_CACHE = false`
2. Delete cache table: `DROP TABLE scrape_cache;`
3. Scraper falls back to non-cached behavior
4. Zero functionality loss

---

## Phase 3: Enterprise Features (Future)

### Goals

1. Track individual competitor vehicles (like dealer inventory)
2. Detect when competitors sell vehicles
3. Build competitor sales history
4. Calculate competitor turn rates
5. Enterprise tier only

### Implementation

**New table:**
```sql
CREATE TABLE competitor_vehicle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  vin TEXT NOT NULL,
  stock_number TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  price DECIMAL(10, 2),
  mileage INTEGER,
  exterior_color TEXT,
  listing_url TEXT,
  image_urls TEXT[],

  -- Tracking fields
  status TEXT CHECK (status IN ('active', 'sold', 'price_changed')),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  price_history JSONB DEFAULT '[]',

  -- Same structure as vehicle_history but for competitors
  UNIQUE(tenant_id, competitor_url, vin)
);
```

**Scraper logic:**
```typescript
// In competitor scraper
const vehicles = await scrapeWebsite(url);

// ALL tiers get aggregated stats
const stats = calculateStats(vehicles);
await saveSnapshot(stats);
await saveHistory(stats);

// ENTERPRISE tier gets detailed tracking
if (subscriptionTier === 'enterprise') {
  await trackCompetitorVehicles(tenantId, competitorUrl, vehicles);
  await detectCompetitorSoldVehicles(tenantId, competitorUrl);
}
```

**Revenue impact:**
- Enterprise tier: $399/month
- Feature justifies premium pricing
- Provides competitive intelligence not available elsewhere

---

## Database Schema

### Current Tables (Phase 1)

#### competitor_snapshots
```sql
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ,

  -- Aggregated stats
  vehicle_count INTEGER,
  avg_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  total_inventory_value DECIMAL(12, 2),
  top_makes JSONB,

  -- Metadata
  scraping_duration_ms INTEGER,
  status TEXT,

  UNIQUE(tenant_id, competitor_url)
);
```

#### competitor_scan_history
```sql
CREATE TABLE competitor_scan_history (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ,

  -- Same fields as competitor_snapshots
  vehicle_count INTEGER,
  avg_price DECIMAL(10, 2),
  -- ... etc
);
```

#### vehicle_history
```sql
CREATE TABLE vehicle_history (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  vin TEXT NOT NULL,
  stock_number TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  price DECIMAL(10, 2),
  mileage INTEGER,
  exterior_color TEXT,
  listing_url TEXT,
  image_urls TEXT[],

  -- Tracking
  status TEXT CHECK (status IN ('active', 'sold', 'price_changed')),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  price_history JSONB,

  -- Date extraction confidence
  listing_date_confidence TEXT,
  listing_date_source TEXT
);
```

#### sales_records
```sql
CREATE TABLE sales_records (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  vehicle_id UUID,
  vin TEXT NOT NULL,
  year INTEGER,
  make TEXT,
  model TEXT,
  sale_price DECIMAL(10, 2),
  acquisition_cost DECIMAL(10, 2),  -- Nullable
  gross_profit DECIMAL(10, 2),      -- Nullable
  margin_percent DECIMAL(5, 2),     -- Nullable
  days_to_sale INTEGER,
  sale_date DATE,

  UNIQUE(tenant_id, vin, sale_date)
);
```

### New Tables (Phase 2)

#### scrape_cache
```sql
CREATE TABLE scrape_cache (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  parsed_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);
```

### New Tables (Phase 3)

#### competitor_vehicle_history
```sql
CREATE TABLE competitor_vehicle_history (
  -- Same structure as vehicle_history
  -- but for competitor vehicles (enterprise tier)
);
```

---

## API Reference

### Scraper Core API

#### scrapeWebsite()
```typescript
async function scrapeWebsite(
  url: string,
  config?: Partial<ScraperConfig>,
  cacheOptions?: Partial<CacheOptions>
): Promise<ParsedVehicle[]>
```

**Parameters:**
- `url`: Website URL to scrape
- `config`: Optional scraper configuration
  - `maxConcurrency`: Max parallel requests (default: 5)
  - `pageDelay`: Delay between batches in ms (default: 800)
  - `maxPages`: Max pagination pages (default: 20)
  - `timeout`: Request timeout in ms (default: 30000)
- `cacheOptions`: Optional cache configuration
  - `enableCache`: Use caching (default: true)
  - `cacheDuration`: Cache duration in ms (default: 24h)
  - `forceRefresh`: Bypass cache (default: false)

**Returns:**
- Array of `ParsedVehicle` objects

**Example:**
```typescript
const vehicles = await scrapeWebsite('https://rpm-motors.us', {
  maxConcurrency: 5,
  pageDelay: 800
});

console.log(`Found ${vehicles.length} vehicles`);
```

#### normalizeUrl()
```typescript
function normalizeUrl(url: string): string
```

**Parameters:**
- `url`: URL in any format

**Returns:**
- Canonical URL (https://domain.com)

**Example:**
```typescript
normalizeUrl('rpm-motors.us')            // => 'https://rpm-motors.us'
normalizeUrl('www.rpm-motors.us')        // => 'https://rpm-motors.us'
normalizeUrl('http://rpm-motors.us')     // => 'https://rpm-motors.us'
```

#### parseInventoryHTML()
```typescript
function parseInventoryHTML(
  html: string,
  baseUrl: string
): ParsedVehicle[]
```

**Parameters:**
- `html`: HTML content to parse
- `baseUrl`: Base URL for resolving relative links

**Returns:**
- Array of `ParsedVehicle` objects

#### decodeVIN()
```typescript
async function decodeVIN(vin: string): Promise<VINDecodedData | null>
```

**Parameters:**
- `vin`: 17-character VIN

**Returns:**
- Decoded vehicle data or null if invalid

#### enrichVehicleWithVIN()
```typescript
async function enrichVehicleWithVIN(
  vehicle: ParsedVehicle
): Promise<ParsedVehicle>
```

**Parameters:**
- `vehicle`: Partial vehicle data

**Returns:**
- Vehicle with missing fields filled from VIN

---

## Testing Strategy

### Unit Tests
- URL normalization with all variations
- Parser with sample HTML from different dealers
- VIN decoder with valid/invalid VINs
- Cache hit/miss logic

### Integration Tests
- Full scrape of rpm-motors.us (expect 91 cars)
- Full scrape of 5 different dealer websites
- Compare competitor vs dealer scraper results (should be identical)

### Performance Tests
- Measure scraping time with/without cache
- Measure HTTP request count
- Test concurrent scraping of multiple sites

### Regression Tests
- Verify database schemas unchanged
- Verify API responses match expected format
- Verify RLS policies still work
- Verify triggers still fire

---

## Deployment Checklist

### Phase 1 Deployment

- [ ] Create `_shared/` directory
- [ ] Create scraper-core.ts
- [ ] Create parser-unified.ts
- [ ] Create url-normalizer.ts
- [ ] Create vin-decoder.ts
- [ ] Create types.ts
- [ ] Backup existing scraper files
- [ ] Refactor competitor scraper to use core
- [ ] Refactor dealer inventory scraper to use core
- [ ] Test with rpm-motors.us (verify 91 cars)
- [ ] Test with 5 different websites
- [ ] Deploy to Supabase Edge Functions
- [ ] Monitor logs for errors
- [ ] Verify daily cron job still works

### Phase 2 Deployment

- [ ] Create migration for scrape_cache table
- [ ] Add cache indexes
- [ ] Add cache cleanup cron job
- [ ] Update scraper-core.ts with caching
- [ ] Add cache configuration
- [ ] Test cache hit/miss scenarios
- [ ] Monitor cache hit rate
- [ ] Deploy to production
- [ ] Verify performance improvements

### Phase 3 Deployment

- [ ] Create migration for competitor_vehicle_history
- [ ] Add RLS policies for enterprise tier
- [ ] Update competitor scraper with detailed tracking
- [ ] Add subscription tier checks
- [ ] Test with enterprise account
- [ ] Deploy to production
- [ ] Update pricing page

---

## Monitoring & Maintenance

### Key Metrics

**Scraping Health:**
- Success rate (target: >95%)
- Average scraping duration (target: <60 seconds)
- Vehicles found per site (compare to historical baseline)

**Cache Performance:**
- Cache hit rate (target: >80% after initial scrape)
- Cache size (monitor storage usage)
- Expired entries cleaned (verify daily cleanup)

**Error Tracking:**
- Failed scrapes by URL
- Parser failures by website
- VIN decoder errors
- Timeout errors

### Logs to Monitor

```sql
-- View recent scraping logs
SELECT * FROM scraping_logs
WHERE log_level = 'error'
ORDER BY created_at DESC
LIMIT 50;

-- Check scraping success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM inventory_snapshots) * 100, 2) as percentage
FROM inventory_snapshots
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Cache hit rate (Phase 2)
SELECT
  DATE(cached_at) as date,
  COUNT(*) as cache_entries,
  SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END) as active_entries
FROM scrape_cache
GROUP BY DATE(cached_at)
ORDER BY date DESC;
```

### Alerts to Set Up

1. **Scraping failure rate > 10%**
   - Check website structure changes
   - Check for IP blocking

2. **Scraping duration > 2 minutes**
   - Investigate slow websites
   - Check server resources

3. **Cache size > 100 MB** (Phase 2)
   - Verify cleanup cron is running
   - Adjust cache duration if needed

4. **Zero vehicles found**
   - Parser likely broken
   - Website structure changed

---

## Troubleshooting

### Problem: Scraper finds 0 vehicles

**Diagnosis:**
```typescript
// Add debug logging
console.log('HTML length:', html.length);
console.log('Found links:', linkMatches.length);
console.log('Vehicle cards:', vehicleCards.length);
```

**Common causes:**
- JavaScript-rendered content (HTML is empty)
- Website structure changed
- IP blocked/captcha required

**Solutions:**
- Check if website requires JavaScript
- Update parser patterns
- Add delay or change user agent

### Problem: Missing some vehicles (found 80 of 91)

**Diagnosis:**
- Check pagination detection
- Verify all inventory URLs discovered
- Look for lazy-loaded content

**Solutions:**
- Update pagination patterns
- Add more inventory URL patterns
- Increase maxPages limit

### Problem: Cache always misses (Phase 2)

**Diagnosis:**
```sql
SELECT * FROM scrape_cache
WHERE url LIKE '%rpm-motors%'
ORDER BY cached_at DESC;
```

**Common causes:**
- URL normalization inconsistency
- Cache expiry too short
- Cache not being written

**Solutions:**
- Verify URL normalization
- Check cache save logic
- Verify database permissions

---

## FAQ

### Why unified scraper instead of two separate ones?

**Benefits:**
- ✅ Single source of truth (fix bugs once)
- ✅ Consistent results (both find same vehicles)
- ✅ Easier maintenance (one codebase)
- ✅ Future-proof (enterprise features reuse same code)

### Why 24-hour cache duration?

**Reasoning:**
- Vehicle inventory doesn't change that frequently
- Reduces server load by 80%+
- Balances freshness vs performance
- Can be adjusted per use case

### Why not use Puppeteer/Playwright for JavaScript sites?

**Reasoning:**
- Most dealer sites are server-rendered HTML
- Headless browsers are slow and resource-intensive
- Edge Functions have limited resources
- Current approach works for 95% of sites
- Can add browser rendering for specific sites if needed

### What if a website blocks our scraper?

**Mitigation:**
- Respectful user agent (identifies as bot)
- Rate limiting (800ms delay between requests)
- Caching (reduces request frequency)
- Can add IP rotation if needed

### How to handle JavaScript-heavy sites?

**Options:**
1. Use their API if available (ideal)
2. Reverse-engineer their AJAX calls
3. Add Puppeteer for specific sites only
4. Partner with data providers (MarketCheck API)

---

## How to Update Scraper Logic

**IMPORTANT: Due to inlined deployment, changes must be made in TWO places**

### Quick Update Process

1. **Make changes to reference files** (optional, for documentation):
   ```bash
   # Edit the reference files in _shared/ if desired
   # This helps document changes but is NOT deployed
   ```

2. **Update BOTH inline files** (required):
   ```bash
   # Make identical changes to:
   supabase/functions/scrape-competitor/scraper-core-inline.ts
   supabase/functions/scrape-dealer-inventory/scraper-core-inline.ts
   ```

3. **Deploy both functions**:
   ```bash
   npx supabase functions deploy scrape-competitor
   npx supabase functions deploy scrape-dealer-inventory
   ```

### Example: Adding a New Parser Strategy

**Scenario:** You want to add support for a new website structure.

**Steps:**

1. Edit `scraper-core-inline.ts` in **both** function folders:
   ```typescript
   // Add new parser function
   function parseNewWebsiteType(html: string, baseUrl: string): ParsedVehicle[] {
     // Your new parsing logic
   }

   // Update parseInventoryHTML to try new parser
   export function parseInventoryHTML(html: string, baseUrl: string): ParsedVehicle[] {
     const parsers = [
       parseStructuredData,
       parseVehicleCards,
       parseNewWebsiteType,  // <-- Add here
       parseGenericSections,
     ];
     // ... rest of function
   }
   ```

2. **Copy the EXACT same changes to both files**:
   - `scrape-competitor/scraper-core-inline.ts`
   - `scrape-dealer-inventory/scraper-core-inline.ts`

3. Test locally if possible, then deploy:
   ```bash
   npx supabase functions deploy scrape-competitor
   npx supabase functions deploy scrape-dealer-inventory
   ```

### Example: Changing Scraper Configuration

**Scenario:** You want to increase concurrency from 5 to 10.

**Steps:**

1. Edit `DEFAULT_SCRAPER_CONFIG` in **both** inline files:
   ```typescript
   const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
     maxConcurrency: 10,  // Changed from 5
     pageDelay: 800,
     maxPages: 20,
     timeout: 30000,
     userAgent: 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0)',
   };
   ```

2. Deploy both functions

### Important Reminders

- ⚠️ **Always update BOTH inline files** - they must remain identical
- ⚠️ Changes to `_shared/` files have **NO EFFECT** on deployed functions
- ⚠️ Test changes with a single website before deploying
- ✅ Keep backup files (`.backup`) in case you need to rollback

### File Comparison Tool

To verify both inline files are identical:

```bash
diff supabase/functions/scrape-competitor/scraper-core-inline.ts \
     supabase/functions/scrape-dealer-inventory/scraper-core-inline.ts

# No output = files are identical ✅
# Output = files differ ❌
```

---

## Changelog

### 2025-11-13
- Created initial architecture documentation
- Defined Phase 1, 2, and 3 roadmap
- Documented scraper core design
- Planned caching strategy
- Implemented inlined deployment approach for Supabase compatibility
- Added maintenance and update procedures

---

## References

- [NHTSA vPIC API Documentation](https://vpic.nhtsa.dot.gov/api/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Edge Functions Limitations](https://supabase.com/docs/guides/functions/limits)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
