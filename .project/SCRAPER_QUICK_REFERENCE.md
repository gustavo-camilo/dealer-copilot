# Scraper Quick Reference Guide

## 🚀 Deployment

```bash
# Deploy both scrapers
npx supabase functions deploy scrape-competitor
npx supabase functions deploy scrape-dealer-inventory
```

## 📁 Current File Structure

```
supabase/functions/
├── scrape-competitor/
│   ├── index.ts                     ✅ Main function
│   └── scraper-core-inline.ts       ✅ All scraping logic (716 lines)
│
└── scrape-dealer-inventory/
    ├── index.ts                     ✅ Main function
    ├── scraper-core-inline.ts       ✅ All scraping logic (716 lines)
    └── dateExtractor.ts             ✅ Dealer-specific date extraction
```

## ⚠️ Important: Inlined Code

**Both `scraper-core-inline.ts` files MUST be identical!**

Why?
- Supabase Edge Functions can't import from parent directories
- Each function must be self-contained
- Changes must be made to BOTH files

## 🔧 Making Changes

### 1. Update BOTH inline files
```bash
# Edit both files with IDENTICAL changes:
code supabase/functions/scrape-competitor/scraper-core-inline.ts
code supabase/functions/scrape-dealer-inventory/scraper-core-inline.ts
```

### 2. Verify files are identical
```bash
diff supabase/functions/scrape-competitor/scraper-core-inline.ts \
     supabase/functions/scrape-dealer-inventory/scraper-core-inline.ts

# No output = identical ✅
# Output = files differ ❌
```

### 3. Deploy both functions
```bash
npx supabase functions deploy scrape-competitor
npx supabase functions deploy scrape-dealer-inventory
```

## 📊 What Each Scraper Does

### Competitor Scraper
- **Input:** Competitor URL
- **Output:** Aggregated stats (count, avg price, top makes, etc.)
- **Saves to:**
  - `competitor_snapshots` (latest snapshot)
  - `competitor_scan_history` (all historical scans)

### Dealer Inventory Scraper
- **Input:** Dealer's own website URL
- **Output:** Individual vehicle tracking
- **Saves to:**
  - `vehicle_history` (all vehicles with status)
  - `sales_records` (when vehicles are marked as sold)
  - `inventory_snapshots` (each scrape run)

## 🔍 Scraper Configuration

Default settings (in `scraper-core-inline.ts`):

```typescript
{
  maxConcurrency: 5,      // Parallel requests
  pageDelay: 800,         // Delay between batches (ms)
  maxPages: 20,           // Max pagination pages
  timeout: 30000,         // Request timeout (ms)
}
```

## 🧪 Testing

Test URL: `rpm-motors.us`

**Expected Results:**
- ✅ Should find **91 vehicles** (actual inventory count)
- ✅ Both scrapers should find the same vehicles
- ✅ Handles URL variations: `rpm-motors.us`, `www.rpm-motors.us`, `https://rpm-motors.us`

## 🐛 Common Issues

### "Module not found" error
**Problem:** Trying to import from `../_shared/`
**Solution:** Use `./scraper-core-inline.ts` instead

### Scrapers finding different counts
**Problem:** Inline files are not identical
**Solution:** Run diff command above, ensure both files match

### Missing vehicles from pagination
**Problem:** Pagination logic not detecting next pages
**Solution:** Check `findNextPageUrl()` in scraper-core-inline.ts

## 📚 Full Documentation

See [SCRAPER_ARCHITECTURE.md](SCRAPER_ARCHITECTURE.md) for:
- Complete architecture overview
- Phase 2 (Caching) implementation plan
- Phase 3 (Enterprise features) roadmap
- Detailed API reference
- Troubleshooting guide

## 📦 Archived Files

Old files moved to [.archive/scraper-refactor-phase1/](.archive/scraper-refactor-phase1/)
- `_shared/` folder (reference only)
- Old `parser.ts` and `vinDecoder.ts` files
- See archive README for details

## 🎯 Next Phase: Caching

When ready to implement caching (Phase 2):
1. Review [Phase 2 section](SCRAPER_ARCHITECTURE.md#phase-2-intelligent-caching-planned) in architecture doc
2. Create `scrape_cache` table
3. Update both `scraper-core-inline.ts` files with caching logic
4. Deploy and monitor performance improvements

---

**Last Updated:** 2025-11-13
**Status:** Phase 1 Complete ✅
