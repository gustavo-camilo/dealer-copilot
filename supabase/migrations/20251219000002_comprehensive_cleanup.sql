-- ============================================================
-- COMPREHENSIVE CLEANUP: Remove ALL legacy tables and objects
-- ============================================================
--
-- This migration completes the transition to unified architecture
-- by removing all legacy tables, views, and functions.
--
-- UNIFIED ARCHITECTURE:
-- - tracked_vehicles (replaces: vehicles, vehicle_history, competitor_vehicles)
-- - inventory_snapshots_unified (replaces: inventory_snapshots, competitor_snapshots)
-- - source_registry (replaces: scraping_waiting_list, competitor_scraping_waiting_list)
--
-- ============================================================

-- Drop legacy tables in dependency order
DROP TABLE IF EXISTS vehicle_price_history CASCADE;
DROP TABLE IF EXISTS vehicle_history CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS competitor_vehicles CASCADE;
DROP TABLE IF EXISTS competitor_snapshots CASCADE;
DROP TABLE IF EXISTS inventory_snapshots CASCADE;
DROP TABLE IF EXISTS scraping_waiting_list CASCADE;
DROP TABLE IF EXISTS competitor_scraping_waiting_list CASCADE;

-- Drop any deprecated tables (already marked with _deprecated suffix)
DROP TABLE IF EXISTS competitor_scan_history_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS competitor_vehicles_deprecated CASCADE;
DROP TABLE IF EXISTS inventory_snapshots_deprecated CASCADE;
DROP TABLE IF EXISTS scraping_waiting_list_deprecated CASCADE;
DROP TABLE IF EXISTS vehicle_history_deprecated CASCADE;

-- Drop legacy views
DROP VIEW IF EXISTS competitor_snapshot_debug CASCADE;
DROP VIEW IF EXISTS scraping_queue_view_old CASCADE;

-- Drop legacy database functions (if any exist)
DROP FUNCTION IF EXISTS process_competitor_csv() CASCADE;
DROP FUNCTION IF EXISTS migrate_vehicle_data() CASCADE;

-- Add comprehensive comments documenting the unified architecture
COMMENT ON TABLE tracked_vehicles IS
  'Unified vehicle tracking for both dealer inventory and competitor vehicles.
   Design Pattern:
   - tenant_id NOT NULL + source_type=''dealer'': Dealer-owned vehicle
   - tenant_id IS NULL + source_type=''competitor'': Global competitor vehicle (visible to all tenants)

   Multi-Tenancy:
   - Dealer vehicles are isolated by tenant_id
   - Competitor vehicles are shared across all tenants

   Unique Constraints:
   - (tenant_id, source_url, vin) for dealer vehicles
   - (source_url, vin) WHERE tenant_id IS NULL for competitor vehicles';

COMMENT ON TABLE inventory_snapshots_unified IS
  'Unified inventory snapshots for both dealers and competitors.
   Design Pattern:
   - tenant_id NOT NULL + source_type=''dealer'': Dealer snapshot (one per tenant per day)
   - tenant_id IS NULL + source_type=''competitor'': Global competitor snapshot (visible to all)

   Aggregation:
   - vehicle_count: Total active vehicles
   - avg_price, min_price, max_price: Pricing statistics
   - avg_mileage, min_mileage, max_mileage: Mileage statistics
   - make_distribution: JSONB object with make counts {''Ford'': 25, ''Chevrolet'': 18}
   - total_inventory_value: Sum of all vehicle prices

   History:
   - One snapshot per source per day (snapshot_date)
   - Upserted daily to update latest stats';

COMMENT ON TABLE source_registry IS
  'Unified source registry for all scraping sources (dealers and competitors).
   Replaces: scraping_waiting_list + competitor_scraping_waiting_list

   Design Pattern:
   - source_type=''dealer'' + tenant_id NOT NULL: Dealer owned by tenant
   - source_type=''competitor'' + tenant_id IS NULL: Global competitor source

   Fields:
   - source_url: Normalized domain (e.g., ''example.com'')
   - source_name: Friendly display name
   - scraping_enabled: Whether automated scraping is active
   - last_scraped_at: Timestamp of last successful scrape
   - next_scheduled_scrape: When the next scrape should run
   - scraping_frequency_hours: How often to scrape (default 24)

   Queue Management:
   - Used by scraping queue management function
   - Status tracked via separate manual_scraping_uploads table
   - No separate waiting list needed';

-- Add column comments for key fields
COMMENT ON COLUMN tracked_vehicles.source_type IS 'Values: ''dealer'' or ''competitor''';
COMMENT ON COLUMN tracked_vehicles.status IS 'Values: ''active'', ''sold'', ''removed''';
COMMENT ON COLUMN tracked_vehicles.tenant_id IS 'NULL for competitor vehicles (global visibility), NOT NULL for dealer vehicles';

COMMENT ON COLUMN inventory_snapshots_unified.source_type IS 'Values: ''dealer'' or ''competitor''';
COMMENT ON COLUMN inventory_snapshots_unified.status IS 'Values: ''success'', ''partial'', ''failed'', ''pending''';
COMMENT ON COLUMN inventory_snapshots_unified.tenant_id IS 'NULL for competitor snapshots (global visibility), NOT NULL for dealer snapshots';

COMMENT ON COLUMN source_registry.source_type IS 'Values: ''dealer'' or ''competitor''';
COMMENT ON COLUMN source_registry.tenant_id IS 'NULL for competitors (global), NOT NULL for dealers';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Comprehensive cleanup completed successfully';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'UNIFIED ARCHITECTURE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Core Tables:';
  RAISE NOTICE '  1. tracked_vehicles';
  RAISE NOTICE '     Replaces: vehicles, vehicle_history, competitor_vehicles';
  RAISE NOTICE '     Pattern: tenant_id NULL = competitor (global)';
  RAISE NOTICE '';
  RAISE NOTICE '  2. inventory_snapshots_unified';
  RAISE NOTICE '     Replaces: inventory_snapshots, competitor_snapshots';
  RAISE NOTICE '     Pattern: tenant_id NULL = competitor (global)';
  RAISE NOTICE '';
  RAISE NOTICE '  3. source_registry';
  RAISE NOTICE '     Replaces: scraping_waiting_list, competitor_scraping_waiting_list';
  RAISE NOTICE '     Pattern: source_type = dealer|competitor';
  RAISE NOTICE '';
  RAISE NOTICE 'Removed ALL legacy tables, views, and functions';
  RAISE NOTICE '========================================';
END $$;
