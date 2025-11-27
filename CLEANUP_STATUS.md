# Dealer Co-Pilot Cleanup Status

> **Last Updated:** November 27, 2025

## ✅ Completed Tasks

### 1. System Guidelines Document
- Created comprehensive `SYSTEM_GUIDELINES.md` with:
  - Quick start guide for new developers/AI
  - Complete architecture documentation
  - Edge functions reference
  - Database schema documentation
  - Legacy components reference
  - Frontend pages status
  - Development guidelines
  - Troubleshooting guide
  - Roadmap & priorities

### 2. Database Audit Queries
- Created `supabase/DATABASE_AUDIT_QUERIES.sql` with 12 queries to:
  - List all tables with row counts
  - Show table sizes and storage usage
  - Identify potential legacy tables
  - Show foreign key relationships
  - List all views and functions
  - Check unified tables status
  - Check legacy tables status
  - Show RLS policies
  - Show index usage
  - Show triggers

### 3. Cleanup Migration Updated
- Enhanced `supabase/migrations/20251127000001_cleanup_legacy_tables.sql` with:
  - Pre-migration verification
  - Step-by-step cleanup process
  - Post-migration verification
  - Clear comments explaining each step
  - Preserved waiting list tables until frontend is updated

### 4. Legacy Files Organized
- Moved backup files to archive folders:
  - `src/pages/AdminPage.tsx.backup` → `src/pages/archive/`
  - `parser-old-backup.ts` → `scrape-dealer-inventory/archive/`

---

## 📋 Next Steps for Database Cleanup

### Step 1: Run Database Audit
1. Go to your Supabase Dashboard
2. Open SQL Editor
3. Copy and run queries from `supabase/DATABASE_AUDIT_QUERIES.sql`
4. Share the results to identify:
   - Tables with 0 rows (safe to drop)
   - Tables marked as deprecated
   - Tables still containing data that needs migration

### Step 2: Verify Data Migration
Before running the cleanup migration, verify:
```sql
-- Check if data is in unified tables
SELECT 
    'tracked_vehicles' AS table_name,
    COUNT(*) AS count
FROM tracked_vehicles
UNION ALL
SELECT 
    'inventory_snapshots_unified',
    COUNT(*)
FROM inventory_snapshots_unified;

-- Check legacy tables still have data
SELECT 
    'vehicles (legacy)' AS table_name,
    COUNT(*) AS count
FROM vehicles
UNION ALL
SELECT 
    'vehicle_history (legacy)',
    COUNT(*)
FROM vehicle_history;
```

### Step 3: Run Cleanup Migration
Once verified, run:
```bash
supabase db push
# or run manually in SQL Editor
```

### Step 4: Update Frontend (After DB Cleanup)
These pages need to be updated to use unified tables:
- [ ] `ManageInventoryPage.tsx` - uses `vehicle_history`
- [ ] `CompetitorAnalysisPage.tsx` - uses `competitor_snapshots`, `competitor_scraping_waiting_list`
- [ ] `AdminPage.tsx` - uses `inventory_snapshots`
- [ ] `OnboardingPage.tsx` - uses `inventory_snapshots`, `scraping_waiting_list`

---

## 📊 Current Database State

### Unified Architecture Tables (KEEP)
| Table | Purpose |
|-------|---------|
| `tracked_vehicles` | All vehicle data |
| `inventory_snapshots_unified` | All snapshots |
| `source_registry` | All sources to track |

### Legacy Tables (TO DROP)
| Table | Status | Notes |
|-------|--------|-------|
| `vehicles` | DEPRECATED | Data should be in `tracked_vehicles` |
| `vehicle_history` | DEPRECATED | Data should be in `tracked_vehicles` |
| `competitor_vehicles` | DEPRECATED | Data should be in `tracked_vehicles` |
| `competitor_snapshots` | DEPRECATED | Data should be in `inventory_snapshots_unified` |
| `inventory_snapshots` | DEPRECATED | Data should be in `inventory_snapshots_unified` |

### Waiting List Tables (KEEP UNTIL FRONTEND UPDATE)
| Table | Status | Notes |
|-------|--------|-------|
| `scraping_waiting_list` | KEEP TEMPORARILY | Frontend still references |
| `competitor_scraping_waiting_list` | KEEP TEMPORARILY | Frontend still references |

---

## 🚀 How to Share Database State

Run this in SQL Editor and share the output:

```sql
-- Quick database summary
SELECT 
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns c 
     WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS size,
    s.n_live_tup AS row_count,
    CASE 
        WHEN t.table_name LIKE '%deprecated%' THEN '⚠️ DEPRECATED'
        WHEN t.table_name IN ('vehicles', 'vehicle_history', 'competitor_vehicles', 
                              'competitor_snapshots', 'inventory_snapshots') 
            AND t.table_name != 'inventory_snapshots_unified' THEN '🔴 LEGACY'
        WHEN t.table_name IN ('tracked_vehicles', 'inventory_snapshots_unified', 
                              'source_registry') THEN '✅ UNIFIED'
        ELSE '📋 ACTIVE'
    END AS status
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN t.table_name LIKE '%deprecated%' THEN 1
        WHEN t.table_name IN ('vehicles', 'vehicle_history', 'competitor_vehicles') THEN 2
        ELSE 3
    END,
    t.table_name;
```

---

## 📁 File Structure After Cleanup

```
dealer-copilot/
├── SYSTEM_GUIDELINES.md         # ← Main documentation (READ FIRST)
├── CLEANUP_STATUS.md            # ← This file
├── src/
│   ├── pages/
│   │   ├── archive/             # ← Old backup files
│   │   └── *.tsx                # Active pages
│   └── ...
├── supabase/
│   ├── DATABASE_AUDIT_QUERIES.sql  # ← Run these to audit DB
│   ├── functions/
│   │   ├── legacy/              # ← DEPRECATED functions
│   │   └── [function-name]/     # Active functions
│   └── migrations/
│       ├── archive/             # ← OLD migrations
│       └── 20251127*.sql        # Active migrations
└── ...
```

---

## Need Help?

1. Read `SYSTEM_GUIDELINES.md` first
2. Run audit queries from `DATABASE_AUDIT_QUERIES.sql`
3. Share results for assistance with cleanup
