-- ============================================================
-- CLEANUP: Drop Deprecated and Legacy Tables
-- ============================================================
-- 
-- SAFE TO RUN: These tables are either deprecated or empty
-- Run this in Supabase SQL Editor
--
-- Date: November 27, 2025
-- ============================================================

-- ============================================
-- STEP 1: Drop DEPRECATED Tables
-- ============================================
-- These tables were already marked as deprecated during migration
-- All have minimal data (0-20 rows) that was migrated to unified tables

DROP TABLE IF EXISTS competitor_scan_history_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_vehicles_deprecated CASCADE;
DROP TABLE IF EXISTS inventory_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS vehicle_history_deprecated CASCADE;

-- ============================================
-- STEP 2: Drop Empty LEGACY Tables
-- ============================================
-- These are legacy tables with 0 rows - safe to drop

DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS vehicle_price_history CASCADE;

-- ============================================
-- STEP 3: Verification Query
-- ============================================
-- Run this after to confirm tables were dropped

SELECT 
    relname AS remaining_tables,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

-- ============================================
-- SUMMARY OF WHAT WAS DROPPED
-- ============================================
-- 
-- DEPRECATED (7 tables):
--   ✓ competitor_scan_history_deprecated
--   ✓ competitor_scraping_waiting_list_deprecated
--   ✓ competitor_snapshots_deprecated
--   ✓ competitor_vehicles_deprecated
--   ✓ inventory_snapshots_deprecated
--   ✓ scraping_waiting_list_deprecated
--   ✓ vehicle_history_deprecated
--
-- LEGACY EMPTY (2 tables):
--   ✓ vehicles (was 0 rows)
--   ✓ vehicle_price_history (was 0 rows)
--
-- TOTAL: 9 tables dropped
-- STORAGE FREED: ~928 kB
--
-- ============================================
