-- ============================================================
-- Migration: 20251127000001_cleanup_legacy_tables.sql
-- ============================================================
-- 
-- PURPOSE: Clean up legacy tables after migration to unified architecture
-- 
-- IMPORTANT: Run the verification queries in DATABASE_AUDIT_QUERIES.sql FIRST
-- to ensure all data has been properly migrated to unified tables.
--
-- Unified Tables (KEEP):
--   - tracked_vehicles
--   - inventory_snapshots_unified
--   - source_registry
--
-- Legacy Tables (DROP):
--   - vehicles
--   - vehicle_history
--   - vehicle_price_history
--   - competitor_vehicles
--   - competitor_snapshots
--   - inventory_snapshots (the old one, not unified)
--   - scraping_waiting_list (moved to source_registry)
--   - competitor_scraping_waiting_list (moved to source_registry)
--
-- ============================================================

-- ============================================
-- STEP 0: Pre-migration Verification
-- ============================================
-- This step logs counts before dropping anything
-- Run this separately to verify data migration is complete

DO $$
DECLARE
    legacy_vehicles_count INT;
    legacy_history_count INT;
    legacy_competitor_count INT;
    unified_vehicles_count INT;
    legacy_snapshots_count INT;
    unified_snapshots_count INT;
BEGIN
    -- Count legacy tables (these may not exist, handle gracefully)
    BEGIN
        SELECT COUNT(*) INTO legacy_vehicles_count FROM vehicles;
    EXCEPTION WHEN undefined_table THEN
        legacy_vehicles_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO legacy_history_count FROM vehicle_history;
    EXCEPTION WHEN undefined_table THEN
        legacy_history_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO legacy_competitor_count FROM competitor_vehicles;
    EXCEPTION WHEN undefined_table THEN
        legacy_competitor_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO legacy_snapshots_count FROM inventory_snapshots;
    EXCEPTION WHEN undefined_table THEN
        legacy_snapshots_count := 0;
    END;
    
    -- Count unified tables
    BEGIN
        SELECT COUNT(*) INTO unified_vehicles_count FROM tracked_vehicles;
    EXCEPTION WHEN undefined_table THEN
        unified_vehicles_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO unified_snapshots_count FROM inventory_snapshots_unified;
    EXCEPTION WHEN undefined_table THEN
        unified_snapshots_count := 0;
    END;
    
    RAISE NOTICE '=== PRE-MIGRATION VERIFICATION ===';
    RAISE NOTICE 'Legacy vehicles: %', legacy_vehicles_count;
    RAISE NOTICE 'Legacy vehicle_history: %', legacy_history_count;
    RAISE NOTICE 'Legacy competitor_vehicles: %', legacy_competitor_count;
    RAISE NOTICE 'Legacy inventory_snapshots: %', legacy_snapshots_count;
    RAISE NOTICE 'Unified tracked_vehicles: %', unified_vehicles_count;
    RAISE NOTICE 'Unified inventory_snapshots_unified: %', unified_snapshots_count;
    RAISE NOTICE '================================';
END $$;

-- ============================================
-- STEP 1: Drop Foreign Key Constraints
-- ============================================
-- Remove constraints that reference legacy tables

DO $$ 
BEGIN
    -- tracked_vehicles might have FK to vehicles
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'tracked_vehicles_vehicle_id_fkey') THEN
        ALTER TABLE tracked_vehicles DROP CONSTRAINT tracked_vehicles_vehicle_id_fkey;
    END IF;
    
    -- sales_records might have FK to vehicles
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'sales_records_vehicle_id_fkey') THEN
        ALTER TABLE sales_records DROP CONSTRAINT sales_records_vehicle_id_fkey;
    END IF;
END $$;

-- ============================================
-- STEP 2: Drop Legacy Views
-- ============================================
-- These views were created for backwards compatibility during migration

DROP VIEW IF EXISTS competitor_scan_history CASCADE;
DROP VIEW IF EXISTS scraping_queue_view CASCADE;

-- Note: inventory_snapshots might be a view OR a table at this point
-- If it's a view pointing to inventory_snapshots_unified, drop it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views 
               WHERE table_name = 'inventory_snapshots' AND table_schema = 'public') THEN
        DROP VIEW IF EXISTS inventory_snapshots CASCADE;
        RAISE NOTICE 'Dropped inventory_snapshots VIEW';
    END IF;
END $$;

-- ============================================
-- STEP 3: Drop Deprecated Tables
-- ============================================
-- Tables that were marked as _deprecated during migration

DROP TABLE IF EXISTS competitor_scan_history_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_vehicles_deprecated CASCADE;
DROP TABLE IF EXISTS inventory_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS vehicle_history_deprecated CASCADE;
DROP TABLE IF EXISTS vehicles_deprecated CASCADE;

-- ============================================
-- STEP 4: Drop Legacy Tables
-- ============================================
-- Main legacy tables that have been replaced by unified tables

-- Legacy competitor data (now in tracked_vehicles)
DROP TABLE IF EXISTS competitor_vehicles CASCADE;
DROP TABLE IF EXISTS competitor_snapshots CASCADE;

-- Legacy dealer data (now in tracked_vehicles)  
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS vehicle_history CASCADE;
DROP TABLE IF EXISTS vehicle_price_history CASCADE;

-- Legacy inventory_snapshots TABLE (if not already a view)
-- Only drop if it's a table, not the unified one
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'inventory_snapshots' 
               AND table_schema = 'public'
               AND table_type = 'BASE TABLE') THEN
        DROP TABLE inventory_snapshots CASCADE;
        RAISE NOTICE 'Dropped inventory_snapshots TABLE';
    END IF;
END $$;

-- ============================================
-- STEP 5: KEEP Legacy Waiting Lists (For Now)
-- ============================================
-- NOTE: These tables are still referenced by the frontend.
-- DO NOT DROP until frontend is updated to use source_registry.
-- 
-- Tables to keep temporarily:
--   - scraping_waiting_list
--   - competitor_scraping_waiting_list
--
-- UNCOMMENT these lines AFTER frontend migration:
-- DROP TABLE IF EXISTS scraping_waiting_list CASCADE;
-- DROP TABLE IF EXISTS competitor_scraping_waiting_list CASCADE;

-- ============================================
-- STEP 6: Cleanup Orphaned Functions
-- ============================================
-- Drop functions that were specific to legacy tables

DROP FUNCTION IF EXISTS update_vehicle_price_history() CASCADE;
DROP FUNCTION IF EXISTS sync_competitor_to_unified() CASCADE;
DROP FUNCTION IF EXISTS sync_dealer_to_unified() CASCADE;

-- ============================================
-- STEP 7: Cleanup Orphaned Triggers
-- ============================================
-- Triggers on dropped tables are automatically removed with CASCADE,
-- but we can be explicit if needed

-- ============================================
-- STEP 8: Post-migration Verification
-- ============================================

DO $$
DECLARE
    unified_vehicles_count INT;
    unified_snapshots_count INT;
    source_registry_count INT;
BEGIN
    SELECT COUNT(*) INTO unified_vehicles_count FROM tracked_vehicles;
    SELECT COUNT(*) INTO unified_snapshots_count FROM inventory_snapshots_unified;
    
    BEGIN
        SELECT COUNT(*) INTO source_registry_count FROM source_registry;
    EXCEPTION WHEN undefined_table THEN
        source_registry_count := 0;
    END;
    
    RAISE NOTICE '=== POST-MIGRATION VERIFICATION ===';
    RAISE NOTICE 'tracked_vehicles: % rows', unified_vehicles_count;
    RAISE NOTICE 'inventory_snapshots_unified: % rows', unified_snapshots_count;
    RAISE NOTICE 'source_registry: % rows', source_registry_count;
    RAISE NOTICE '=================================';
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- Next steps:
-- 1. Update frontend pages to use unified tables
-- 2. Remove references to legacy tables from frontend
-- 3. Uncomment Step 5 to drop waiting list tables
-- 4. Run DATABASE_AUDIT_QUERIES.sql to verify cleanup
--
-- ============================================
