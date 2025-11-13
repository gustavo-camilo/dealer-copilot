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
Scrapes the tenant's own website to build **individual vehicle tracking** with sales history.

**Features:**
- Pagination support (scrapes all inventory pages)
- VIN extraction with multiple patterns
- Title case formatting for make/model
- VIN decoder fallback (NHTSA API)
- Comprehensive brand support (50+ brands)

**Data Stored:**
- ✅ **Individual vehicles** in `vehicle_history` table
- ✅ VIN-level tracking with first_seen/last_seen dates
- ✅ Price history for each vehicle
- ✅ Automatic sold vehicle detection
- ✅ Sales records generation

**How VIN Matching Works:**
1. **First scrape**: Vehicle is **inserted** with its VIN (or generated ID)
2. **Subsequent scrapes**: Same VIN → Vehicle is **updated** (not duplicated)
3. **Price changes**: Tracked in `price_history` array
4. **Disappeared vehicles**: Marked as "sold" after 2 days absent

---

### scrape-competitor
Scrapes competitor websites for **aggregate market intelligence** only.

**Features:**
- Automatic pagination
- Parallel detail page fetching
- VIN decoder integration
- Aggregated statistics calculation

**Data Stored:**
- ✅ **Aggregate stats only** (no individual vehicles)
- ✅ Total vehicle count
- ✅ Average/min/max price and mileage
- ✅ Top 5 makes distribution
- ✅ Total inventory value
- ✅ Historical snapshots in `competitor_scan_history`
- ✅ Current snapshot in `competitor_snapshots` (upserted)

**How VIN Matching Works:**
- ❌ **No VIN-level tracking** - individual vehicles are NOT stored
- ❌ Cannot detect price changes on specific vehicles
- ❌ Cannot track when specific vehicles are added/removed
- ✅ VIN decoder is used during scraping for accurate stats
- ✅ Each scan replaces previous snapshot (no duplicates)

**Why Aggregate-Only?**
- 🚀 **Performance**: Faster scans, less storage
- 💰 **Cost**: Minimal database usage
- 📊 **Use case**: Market trends, not vehicle-level tracking
- 🎯 **Focus**: "What's the competitor's average price?" not "Is this VIN still available?"

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
