# Supabase Edge Functions

This directory contains Edge Functions for the Dealer Co-Pilot application.

## Important: Shared Code Pattern

**Note:** Supabase Edge Functions must be self-contained for deployment. Each function directory needs its own copy of shared utilities.

### VIN Decoder Utility

The `vinDecoder.ts` utility is currently duplicated in:
- `scrape-dealer-inventory/vinDecoder.ts`
- `scrape-competitor/vinDecoder.ts`

**Why duplicated?**
- Supabase deploys each function independently
- Functions cannot import from `_shared/` during deployment
- Each function must be self-contained

**When updating vinDecoder.ts:**
1. Update the file in ONE location
2. Copy it to ALL other function directories that use it:
   ```bash
   cp scrape-dealer-inventory/vinDecoder.ts scrape-competitor/vinDecoder.ts
   ```

## Functions Overview

### scrape-dealer-inventory
Scrapes the tenant's own website to build vehicle inventory history and sales records.

**Features:**
- Pagination support (scrapes all inventory pages)
- VIN extraction with multiple patterns
- Title case formatting for make/model
- VIN decoder fallback (NHTSA API)
- Comprehensive brand support (50+ brands)

### scrape-competitor
Scrapes competitor websites for market intelligence and pricing analysis.

**Features:**
- Automatic pagination
- Parallel detail page fetching
- VIN decoder integration
- Aggregated statistics calculation

## VIN Decoder

Both scrapers use the free NHTSA vPIC API to enrich vehicle data when VIN is available but make/model/year is missing.

**Key features:**
- 100% free, no API key required
- No rate limits (1000-2000 requests/minute)
- Automatic title case formatting
- Only fills missing fields (doesn't override existing data)

**Usage in any function:**
```typescript
import { enrichVehicleWithVIN } from './vinDecoder.ts';

const enriched = await enrichVehicleWithVIN(vehicle);
```
