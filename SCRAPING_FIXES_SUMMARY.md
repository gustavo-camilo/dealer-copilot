# Scraping Fixes Summary

## Issues Fixed

### 1. ✅ Duplicate Key Constraint Error
**Problem:** Trying to scrape multiple times per day caused error: `duplicate key value violates unique constraint "inventory_snapshots_tenant_id_snapshot_date_key"`

**Root Cause:** The `inventory_snapshots` table had a `UNIQUE(tenant_id, snapshot_date)` constraint that prevented multiple scrapes on the same day.

**Solution:** Created migration [20251112000003_fix_snapshot_constraint.sql](supabase/migrations/20251112000003_fix_snapshot_constraint.sql) that removes this constraint, allowing unlimited scrapes per day.

---

### 2. ✅ Vehicle Details Not Being Extracted
**Problem:** Scraper only found vehicle count (91 vehicles) but didn't extract complete details like model, VIN, stock numbers, etc.

**Root Cause:** The parser was only extracting basic information from listing pages, not fetching individual vehicle detail pages where complete information is available.

**Solutions Implemented:**

#### A. Enhanced Model Extraction ([parser.ts](supabase/functions/scrape-dealer-inventory/parser.ts))
- Added new `extractModel()` function that intelligently extracts vehicle models from text
- Patterns matched: "2020 Toyota Camry" → extracts "Camry"
- Filters out common non-model words like "for sale", "certified", etc.
- Applied model extraction to all parser strategies (WordPress, generic cards, vehicle links)

#### B. Individual Vehicle Page Fetching ([index.ts](supabase/functions/scrape-dealer-inventory/index.ts))
- Added new `enhanceVehicleData()` function that:
  - Fetches individual vehicle detail pages (where VINs and complete specs are)
  - Processes 5 pages at a time to be respectful to dealer websites
  - Merges detail page data with listing page data (prefers detail page data)
  - Falls back gracefully if detail pages can't be fetched

**Flow:**
```
Listing Page → Extract Basic Info → Fetch Detail Pages → Extract Complete Info → Save to DB
```

---

### 3. ✅ Vehicles Not Showing in Manage Inventory
**Problem:** After scraping, "Manage Inventory" page showed "No vehicles found" even though 91 vehicles were detected.

**Root Cause:** The scraper was skipping ALL vehicles without VINs (line 362 in old code: `if (!vehicle.vin) continue;`)

**Solution:** Implemented intelligent identifier generation system:

1. **Primary:** Use real VIN if available
2. **Fallback 1:** Use stock number: `STOCK_{stock_number}`
3. **Fallback 2:** Generate from vehicle data: `{year}_{make}_{model}_{trim}_{mileage}_{color}_{price}`
4. **Fallback 3:** If duplicate detected, append URL hash: `{identifier}_{urlhash}`
5. **Skip:** Only skip if we don't have enough data to identify the vehicle

**Example Identifiers:**
- Real VIN: `1HGCM82633A123456`
- Stock-based: `STOCK_A12345`
- Generated: `2020_TOYOTA_CAMRY_LE_45000_BLUE_25000`
- With URL hash (if duplicate): `2020_TOYOTA_CAMRY_LE_45000_BLUE_25000_inv12345`

**Uniqueness Handling:**
- Includes mileage, trim, and color to differentiate similar vehicles
- Detects duplicates within the same batch
- Appends URL hash as last resort for uniqueness
- Ensures two identical vehicles are never treated as one

This ensures vehicles are tracked even without VINs, which is common on many dealer websites.

---

### 4. ✅ Analysis Data Not Generated
**Problem:** No data available for analysis because no vehicles were being saved.

**Solution:** Since vehicles are now properly saved to `vehicle_history` table with complete details, the analysis views and functions will now have data to work with.

**Data Now Available:**
- Vehicle inventory snapshots
- Price history tracking
- Sales records (auto-created when vehicles are marked sold)
- Days in inventory
- Make/model distribution
- Price trends

---

---

### 5. ✅ VIN and Mileage Extraction Fixed
**Problem:** VINs and mileage were present on detail pages but weren't being extracted.

**Root Cause:** The extraction patterns were too simplistic and didn't match real-world HTML structures.

**Solution:** Implemented multi-strategy extraction:

**VIN Extraction ([parser.ts:346-379](supabase/functions/scrape-dealer-inventory/parser.ts#L346-L379)):**
1. Look for labeled VIN fields (`VIN: ...`)
2. Check HTML attributes (`data-vin="..."`)
3. Search for 17-character VINs anywhere in content

**Mileage Extraction ([parser.ts:444-482](supabase/functions/scrape-dealer-inventory/parser.ts#L444-L482)):**
1. Look for labeled fields (`Mileage: 45,000 mi`)
2. Check HTML attributes (`data-mileage="45000"`)
3. Extract from various formats (mi, miles, km)
4. Validate ranges (0-999,999) to avoid false positives

---

### 6. ✅ Listing Date Extraction from Images
**Problem:** Listing dates weren't being captured accurately, but were available in image filenames.

**Example:** `IMG-20250724-WA0033.jpg` contains date `2025-07-24`

**Solution:** Implemented intelligent image date extraction ([parser.ts:547-622](supabase/functions/scrape-dealer-inventory/parser.ts#L547-L622)):

**Safety Measures:**
- Requires **at least 2 images** with dates to ensure they're vehicle photos (not logos/headers)
- Validates date ranges (2020-2030)
- Checks dates are within 7 days of each other (same photoshoot)
- Only extracts from vehicle-related filenames

**Patterns Detected:**
- `IMG-YYYYMMDD-*` format
- `photo-YYYYMMDD-*` format
- Generic `YYYYMMDD` in vehicle image filenames

**Priority:** Image dates now have **highest priority** in date extraction ([dateExtractor.ts:25-32](supabase/functions/scrape-dealer-inventory/dateExtractor.ts#L25-L32))

---

### 7. ✅ Fixed Wrong Vehicle Data Matching
**Problem:** Ford Explorer showing Kia Forte data - parser was mixing data from different vehicles.

**Root Cause:** The data enhancement was blindly overwriting listing page data with detail page data without validation.

**Solution:** Added vehicle matching validation ([index.ts:67-96](supabase/functions/scrape-dealer-inventory/index.ts#L67-L96)):

**Validation Logic:**
1. Compare year between listing and detail page
2. Compare make between listing and detail page
3. Only merge if both match
4. If mismatch detected, keep original listing data
5. Log warnings when mismatches occur

**Merge Strategy:**
- Keep listing data as base
- Only add detail data if not already present
- Never override with conflicting data
- Always preserve the original URL

**Example Log:**
```
⚠️ Vehicle mismatch: listing shows 2024 Ford, detail page shows 2024 Kia. Keeping listing data.
```

---

## Files Modified

### New Migration
- **[supabase/migrations/20251112000003_fix_snapshot_constraint.sql](supabase/migrations/20251112000003_fix_snapshot_constraint.sql)**
  - Removes unique constraint on `snapshot_date`
  - Allows multiple scrapes per day

### Enhanced Parser
- **[supabase/functions/scrape-dealer-inventory/parser.ts](supabase/functions/scrape-dealer-inventory/parser.ts)**
  - Added `extractModel()` function (lines 484-521) - intelligent model extraction
  - Added `extractVIN()` multi-strategy function (lines 346-379) - finds VINs in various formats
  - Added `extractMileage()` function (lines 444-482) - extracts mileage with validation
  - Added `extractDateFromImages()` function (lines 547-622) - extracts dates from vehicle photos
  - Updated all parsers to use new extraction functions
  - Added `imageDate` field to `ParsedVehicle` interface

### Enhanced Scraper
- **[supabase/functions/scrape-dealer-inventory/index.ts](supabase/functions/scrape-dealer-inventory/index.ts)**
  - Rewrote `enhanceVehicleData()` function (lines 35-113) with vehicle matching validation
  - Added year/make validation before merging data
  - Improved merge strategy to preserve listing data
  - Added mismatch warning logs
  - Integrated image date extraction into listing date flow (line 511)
  - Implemented intelligent identifier generation (lines 431-466)
  - Updated vehicle lookup to use identifiers
  - Updated sold vehicle tracking to handle identifiers

### Enhanced Date Extractor
- **[supabase/functions/scrape-dealer-inventory/dateExtractor.ts](supabase/functions/scrape-dealer-inventory/dateExtractor.ts)**
  - Added `imageDate` parameter to `getActualListingDate()` (line 23)
  - Image dates now have **highest priority** (lines 25-32)
  - New source type: `'image_filename'` with `'high'` confidence

---

## How It Works Now

### Complete Scraping Flow

```
1. User clicks "Scan Website" on Onboarding Page
   ↓
2. Edge Function discovers inventory pages
   ↓
3. Fetches listing page HTML
   ↓
4. Parses listing page for basic vehicle info (year, make, price, URLs, images)
   ↓
5. **NEW:** Extracts dates from vehicle image filenames (IMG-20250724-*.jpg)
   ↓
6. **NEW:** Fetches each individual vehicle detail page (5 at a time)
   ↓
7. **NEW:** Validates year/make match before merging data
   ↓
8. **NEW:** Extracts VIN using multi-strategy patterns
   ↓
9. **NEW:** Extracts mileage with validation
   ↓
10. **NEW:** Extracts complete details (model, trim, color, stock number)
   ↓
11. **NEW:** Generates unique identifier if VIN is missing (includes mileage, trim, color)
   ↓
12. Extracts accurate listing dates (prioritizes image dates)
   ↓
13. Saves to vehicle_history table with all details
   ↓
14. Creates inventory snapshot with stats
   ↓
15. Tracks price changes and sold vehicles
   ↓
16. Auto-creates sales records for sold vehicles
   ↓
17. Data available for AI analysis and recommendations
```

### Database Tables Populated

1. **`vehicle_history`** - All current and historical vehicles
   - Complete vehicle details (year, make, model, VIN/identifier)
   - Pricing and mileage
   - Images and listing URLs
   - Status tracking (active/sold/price_changed)

2. **`inventory_snapshots`** - Each scraping run
   - Vehicles found count
   - Status (success/failed/partial)
   - Duration and performance metrics
   - Raw scraped data (JSONB)

3. **`sales_records`** - Auto-generated when vehicles sell
   - Sale price and days to sale
   - Calculated from vehicle history

4. **`sitemap_cache`** - Website sitemap data
   - Used for accurate listing date extraction
   - 24-hour cache

---

## Testing the Fix

### To test locally:
1. Start Supabase: `npx supabase start` (requires Docker)
2. Apply migrations: `npx supabase db reset`
3. Run the app: `npm run dev`
4. Go to Onboarding page
5. Click "Scan Website" multiple times (no more duplicate errors!)
6. Go to "Manage Inventory" → Should see all scraped vehicles

### Expected Results:
- ✅ Multiple scrapes per day work without errors
- ✅ All vehicles appear in Manage Inventory with complete data
- ✅ Each vehicle has year, make, model, price, mileage
- ✅ **VINs extracted from detail pages** when available
- ✅ **Mileage accurately extracted** from various formats
- ✅ **Listing dates from image filenames** (high accuracy for new listings)
- ✅ **No more wrong vehicle matches** (Ford showing as Kia, etc.)
- ✅ Images and listing URLs preserved
- ✅ Unique identifiers for vehicles without VINs (includes all distinguishing features)
- ✅ Analysis data available for AI recommendations

---

## Notes for Deployment

1. **Migration Required:** The new migration must be applied to production database
2. **Edge Function:** Deploy updated scraper functions to Supabase
3. **Performance:** Scraping is now slower but much more thorough (fetches detail pages)
4. **Rate Limiting:** Built-in concurrency limit (5 pages at a time) to avoid overloading dealer sites
5. **Fallback:** System gracefully handles failures at each step

---

## Future Enhancements (Optional)

1. **Caching:** Cache detail page HTML to avoid re-fetching unchanged vehicles
2. **Selective Fetching:** Only fetch detail pages for vehicles missing critical data
3. **Pagination:** Handle multi-page inventory listings (currently only processes first page with vehicles)
4. **Error Recovery:** Retry failed detail page fetches with exponential backoff
5. **Real-time Updates:** WebSocket notifications for scraping progress

---

## Questions?

If you encounter issues:
1. Check Supabase logs: Edge Function logs for scraping errors
2. Check database: `inventory_snapshots` table for error messages
3. Check browser console: Frontend errors during scraping
4. Review `scraping_logs` table for detailed audit trail
