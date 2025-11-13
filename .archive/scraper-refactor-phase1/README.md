# Scraper Refactor Phase 1 - Archived Files

**Date:** 2025-11-13

## Overview

This folder contains files from the scraper refactor (Phase 1) that are **no longer used in production** but kept for reference.

## What's Archived

### `_shared/` folder
**Status:** Reference only, NOT deployed

Original attempt to create shared code across functions. Supabase Edge Functions don't support importing from parent directories, so we switched to an inlined approach.

**Contents:**
- `scraper-core.ts` - Main scraping orchestrator
- `parser-unified.ts` - Unified HTML parser
- `url-normalizer.ts` - URL handling utilities
- `vin-decoder.ts` - VIN enrichment logic
- `types.ts` - Shared TypeScript interfaces

**Use Case:**
- Reference documentation for how the scraper works
- Template for understanding the architecture
- NOT used in deployed code

### Old Parser and VIN Decoder Files

**From:** `scrape-competitor/` and `scrape-dealer-inventory/`

- `parser.ts` - Original HTML parser (before unification)
- `vinDecoder.ts` - Original VIN decoder (before unification)

**Status:** Replaced by `scraper-core-inline.ts` in each function

## Current Production Structure

```
supabase/functions/
├── scrape-competitor/
│   ├── index.ts                     (✅ DEPLOYED)
│   ├── scraper-core-inline.ts       (✅ DEPLOYED - contains all shared logic)
│   ├── parser.ts.backup             (Backup of old version)
│   └── vinDecoder.ts.backup         (Backup of old version)
│
└── scrape-dealer-inventory/
    ├── index.ts                     (✅ DEPLOYED)
    ├── scraper-core-inline.ts       (✅ DEPLOYED - contains all shared logic)
    ├── dateExtractor.ts             (✅ DEPLOYED - dealer-specific)
    ├── parser.ts.backup             (Backup of old version)
    └── vinDecoder.ts.backup         (Backup of old version)
```

## Why the Change?

**Problem:** Supabase Edge Functions deploy independently and can't import from `../_shared/`

**Solution:** Inline all shared code into each function's `scraper-core-inline.ts`

**Trade-offs:**
- ❌ Code is duplicated (less DRY)
- ✅ Deploys successfully to Supabase
- ✅ Each function is self-contained
- ✅ Still maintains consistency (same logic in both files)

## Rollback Instructions

If you need to rollback to the old architecture:

1. Copy files from this archive back to their original locations
2. Update imports in `index.ts` files
3. Revert to old deployment approach

**Note:** This is NOT recommended as the old architecture doesn't work with Supabase Edge Functions.

## See Also

- [SCRAPER_ARCHITECTURE.md](../../SCRAPER_ARCHITECTURE.md) - Complete documentation
- [How to Update Scraper Logic](../../SCRAPER_ARCHITECTURE.md#how-to-update-scraper-logic) - Maintenance guide
