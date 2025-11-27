-- ==========================================================
-- DEALER CO-PILOT: DATABASE AUDIT QUERIES
-- ==========================================================
-- Run these queries in your Supabase SQL Editor and share 
-- the results to help identify unused tables and cleanup opportunities.
-- 
-- Last Updated: 2025-11-27
-- ==========================================================

-- ============================================
-- QUERY 1: List ALL Tables with Row Counts
-- ============================================
-- This shows every table and how many rows it has.
-- Tables with 0 rows are likely unused or legacy.

SELECT 
    schemaname,
    relname AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================
-- QUERY 2: Table Sizes (Storage Usage)
-- ============================================
-- Shows how much disk space each table uses.
-- Helps identify large tables that might need cleanup.

SELECT 
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS data_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;

-- ============================================
-- QUERY 3: List All Tables with Schema Info
-- ============================================
-- Shows table names and their column structure
-- to understand what each table contains.

SELECT 
    t.table_name,
    array_agg(c.column_name || ' (' || c.data_type || ')' ORDER BY c.ordinal_position) AS columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================
-- QUERY 4: Identify Potential Legacy Tables
-- ============================================
-- Tables that might be legacy based on naming patterns
-- or lack of recent activity.

SELECT 
    relname AS table_name,
    n_live_tup AS row_count,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    CASE 
        WHEN relname LIKE '%deprecated%' THEN 'MARKED DEPRECATED'
        WHEN relname LIKE '%legacy%' THEN 'MARKED LEGACY'
        WHEN relname LIKE '%old%' THEN 'POSSIBLY OLD'
        WHEN relname LIKE '%backup%' THEN 'BACKUP TABLE'
        WHEN n_live_tup = 0 THEN 'EMPTY TABLE'
        ELSE 'ACTIVE'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY 
    CASE 
        WHEN relname LIKE '%deprecated%' THEN 1
        WHEN relname LIKE '%legacy%' THEN 2
        WHEN relname LIKE '%old%' THEN 3
        WHEN relname LIKE '%backup%' THEN 4
        WHEN n_live_tup = 0 THEN 5
        ELSE 6
    END,
    relname;

-- ============================================
-- QUERY 5: Foreign Key Relationships
-- ============================================
-- Shows which tables reference each other.
-- Helps understand dependencies before dropping tables.

SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- QUERY 6: List All Views
-- ============================================
-- Shows views which may reference legacy tables.

SELECT 
    table_name AS view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- QUERY 7: List All Functions
-- ============================================
-- Shows database functions that might need cleanup.

SELECT 
    routine_name AS function_name,
    routine_type,
    data_type AS return_type,
    routine_definition IS NOT NULL AS has_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================
-- QUERY 8: Check UNIFIED Tables Status
-- ============================================
-- Shows the status of the new unified architecture tables.

SELECT 
    'tracked_vehicles' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(DISTINCT tenant_id) AS unique_tenants,
    COUNT(*) FILTER (WHERE source_type = 'dealer') AS dealer_vehicles,
    COUNT(*) FILTER (WHERE source_type = 'competitor') AS competitor_vehicles,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'sold') AS sold
FROM tracked_vehicles

UNION ALL

SELECT 
    'inventory_snapshots_unified' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(DISTINCT tenant_id) AS unique_tenants,
    COUNT(*) FILTER (WHERE source_type = 'dealer') AS dealer_snapshots,
    COUNT(*) FILTER (WHERE source_type = 'competitor') AS competitor_snapshots,
    NULL AS active,
    NULL AS sold
FROM inventory_snapshots_unified

UNION ALL

SELECT 
    'source_registry' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(DISTINCT tenant_id) AS unique_tenants,
    COUNT(*) FILTER (WHERE source_type = 'dealer') AS dealer_sources,
    COUNT(*) FILTER (WHERE source_type = 'competitor') AS competitor_sources,
    COUNT(*) FILTER (WHERE scraping_enabled = true) AS enabled,
    COUNT(*) FILTER (WHERE scraping_enabled = false) AS disabled
FROM source_registry;

-- ============================================
-- QUERY 9: Check Legacy Tables Status
-- ============================================
-- Shows which legacy tables still exist (if any).
-- Uses information_schema to check existence safely.

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('vehicles', 'vehicle_history', 'competitor_vehicles') 
            THEN 'Should migrate to tracked_vehicles'
        WHEN table_name IN ('competitor_snapshots', 'inventory_snapshots') 
            THEN 'Should migrate to inventory_snapshots_unified'
        WHEN table_name IN ('scraping_waiting_list', 'competitor_scraping_waiting_list') 
            THEN 'Should migrate to source_registry'
        ELSE 'Review needed'
    END AS notes,
    'EXISTS - Consider dropping' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'vehicles',
    'vehicle_history', 
    'competitor_vehicles',
    'competitor_snapshots',
    'inventory_snapshots',
    'scraping_waiting_list',
    'competitor_scraping_waiting_list'
  )
ORDER BY table_name;

-- If no results, all legacy tables have been dropped! ✅

-- ============================================
-- QUERY 10: RLS Policies Overview
-- ============================================
-- Shows all Row Level Security policies.
-- Important to understand before dropping tables.

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- QUERY 11: Index Usage Statistics
-- ============================================
-- Shows which indexes are being used or not.
-- Unused indexes waste storage and slow writes.

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS times_used,
    idx_tup_read AS rows_read,
    idx_tup_fetch AS rows_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- ============================================
-- QUERY 12: Triggers Overview
-- ============================================
-- Shows all triggers which may need to be updated
-- when migrating to unified tables.

SELECT 
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS trigger_event,
    action_timing AS timing,
    action_statement AS action
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- SUMMARY OUTPUT FORMAT
-- ============================================
-- After running these queries, share results in this format:
--
-- ## Tables to Review
-- | Table Name | Row Count | Status | Notes |
-- |------------|-----------|--------|-------|
-- | vehicles   | 1234      | LEGACY | Migrate to tracked_vehicles |
-- | ...        | ...       | ...    | ... |
--
-- ## Views to Review  
-- | View Name | Referenced Tables | Status |
-- |-----------|-------------------|--------|
-- | ...       | ...               | ...    |
--
-- ## Recommendations
-- - Drop empty tables: [list]
-- - Migrate data from: [list]
-- - Keep tables: [list]
