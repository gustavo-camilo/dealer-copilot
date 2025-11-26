-- Migration file: 20251126000004_switch_to_unified_views.sql

-- 1. Rename old tables to _deprecated
-- We use IF EXISTS to make this idempotent and safe if tables are already renamed
ALTER TABLE IF EXISTS vehicle_history RENAME TO vehicle_history_deprecated;
ALTER TABLE IF EXISTS competitor_vehicles RENAME TO competitor_vehicles_deprecated;
ALTER TABLE IF EXISTS inventory_snapshots RENAME TO inventory_snapshots_deprecated;
ALTER TABLE IF EXISTS competitor_snapshots RENAME TO competitor_snapshots_deprecated;
ALTER TABLE IF EXISTS competitor_scan_history RENAME TO competitor_scan_history_deprecated;

-- 2. Create helper views for backward compatibility
-- These views expose the NEW tables using the OLD table names and schemas

CREATE OR REPLACE VIEW vehicle_history AS
SELECT 
  id,
  tenant_id,
  vehicle_id,
  vin,
  stock_number,
  year,
  make,
  model,
  trim,
  price,
  mileage,
  exterior_color,
  listing_url,
  ARRAY[image_url] as image_urls,  -- Wrap in array for compatibility
  first_seen_at,
  last_seen_at,
  status,
  listing_date_confidence,
  listing_date_source,
  price_history,
  created_at,
  updated_at
FROM tracked_vehicles
WHERE source_type = 'dealer' AND tenant_id IS NOT NULL;

CREATE OR REPLACE VIEW competitor_vehicles AS
SELECT 
  id,
  source_url as competitor_url,
  vin,
  year,
  make,
  model,
  trim,
  price,
  mileage,
  listing_url,
  image_url,
  first_seen_at,
  last_seen_at,
  status,
  created_at,
  updated_at
FROM tracked_vehicles
WHERE source_type = 'competitor' AND tenant_id IS NULL;

CREATE OR REPLACE VIEW competitor_snapshots AS
SELECT 
  id,
  source_url as competitor_url,
  source_name as competitor_name,
  scanned_at,
  vehicle_count,
  avg_price,
  min_price,
  max_price,
  avg_mileage,
  min_mileage,
  max_mileage,
  total_inventory_value,
  make_distribution as top_makes,
  scraping_duration_ms,
  status,
  error_message
FROM inventory_snapshots_unified
WHERE source_type = 'competitor' 
  AND tenant_id IS NULL
  AND snapshot_date = (
    SELECT MAX(snapshot_date) 
    FROM inventory_snapshots_unified s2 
    WHERE s2.source_url = inventory_snapshots_unified.source_url
  );

CREATE OR REPLACE VIEW competitor_scan_history AS
SELECT 
  id,
  source_url as competitor_url,
  source_name as competitor_name,
  scanned_at,
  vehicle_count,
  avg_price,
  total_inventory_value,
  make_distribution as top_makes
FROM inventory_snapshots_unified
WHERE source_type = 'competitor' AND tenant_id IS NULL
ORDER BY scanned_at DESC;

CREATE OR REPLACE VIEW inventory_snapshots AS
SELECT 
  id,
  tenant_id,
  snapshot_date,
  vehicle_count as total_vehicles,
  total_inventory_value as total_value,
  avg_price,
  avg_mileage,
  avg_vehicle_age as avg_age,
  avg_days_in_inventory,
  make_distribution,
  model_distribution,
  price_distribution,
  status,
  error_message,
  scraping_duration_ms,
  raw_data,
  created_at
FROM inventory_snapshots_unified
WHERE source_type = 'dealer' AND tenant_id IS NOT NULL;
