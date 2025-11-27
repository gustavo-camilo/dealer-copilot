-- Migration file: 20251126000002_migrate_vehicle_data.sql

-- 1. Populate source_registry
INSERT INTO source_registry (source_url, source_type, source_name, tenant_id)
SELECT DISTINCT
  website_url,
  'dealer',
  name,
  id
FROM tenants
WHERE website_url IS NOT NULL
ON CONFLICT (source_url) DO NOTHING;

-- Add competitor sources from competitor_vehicles
INSERT INTO source_registry (source_url, source_type)
SELECT DISTINCT competitor_url, 'competitor'
FROM competitor_vehicles
ON CONFLICT (source_url) DO NOTHING;

-- Add competitor sources from competitor_snapshots
INSERT INTO source_registry (source_url, source_type)
SELECT DISTINCT competitor_url, 'competitor'
FROM competitor_snapshots
WHERE NOT EXISTS (
  SELECT 1 FROM source_registry WHERE source_url = competitor_snapshots.competitor_url
)
ON CONFLICT (source_url) DO NOTHING;

-- 2. Migrate vehicle_history to tracked_vehicles
INSERT INTO tracked_vehicles (
  tenant_id,
  source_url,
  source_type,
  vin,
  stock_number,
  listing_url,
  year,
  make,
  model,
  trim,
  price,
  mileage,
  exterior_color,
  image_url,
  first_seen_at,
  last_seen_at,
  status,
  listing_date_confidence,
  listing_date_source,
  price_history,
  vehicle_id,
  created_at,
  updated_at
)
SELECT 
  vh.tenant_id,
  t.website_url,
  'dealer',
  vh.vin,
  vh.stock_number,
  vh.listing_url,
  vh.year,
  vh.make,
  vh.model,
  vh.trim,
  vh.price,
  vh.mileage,
  vh.exterior_color,
  (vh.image_urls[1]),  -- Take first image
  vh.first_seen_at,
  vh.last_seen_at,
  vh.status,
  vh.listing_date_confidence,
  vh.listing_date_source,
  vh.price_history,
  vh.vehicle_id,
  vh.created_at,
  vh.updated_at
FROM vehicle_history vh
JOIN tenants t ON vh.tenant_id = t.id
WHERE t.website_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Migrate competitor_vehicles to tracked_vehicles
INSERT INTO tracked_vehicles (
  tenant_id,
  source_url,
  source_type,
  vin,
  listing_url,
  year,
  make,
  model,
  trim,
  price,
  mileage,
  image_url,
  first_seen_at,
  last_seen_at,
  status,
  created_at,
  updated_at
)
SELECT 
  NULL,  -- No tenant ownership
  competitor_url,
  'competitor',
  vin,
  listing_url,
  year,
  make,
  model,
  trim,
  price,
  mileage,
  image_url,
  first_seen_at,
  last_seen_at,
  status,
  created_at,
  updated_at
FROM competitor_vehicles
ON CONFLICT DO NOTHING;

-- 4. Migrate inventory_snapshots to inventory_snapshots_unified
INSERT INTO inventory_snapshots_unified (
  tenant_id,
  source_url,
  source_type,
  source_name,
  snapshot_date,
  scanned_at,
  vehicle_count,
  total_inventory_value,
  avg_price,
  avg_mileage,
  avg_days_in_inventory,
  avg_vehicle_age,
  make_distribution,
  model_distribution,
  price_distribution,
  scraping_duration_ms,
  status,
  error_message,
  raw_data,
  created_at
)
SELECT 
  inv.tenant_id,
  t.website_url,
  'dealer',
  t.name,
  inv.snapshot_date,
  inv.created_at,  -- Use created_at as scanned_at
  inv.total_vehicles,
  inv.total_value,
  inv.avg_price,
  inv.avg_mileage,
  inv.avg_days_in_inventory,
  inv.avg_age,
  inv.make_distribution,
  inv.model_distribution,
  inv.price_distribution,
  inv.scraping_duration_ms,
  inv.status,
  inv.error_message,
  inv.raw_data,
  inv.created_at
FROM inventory_snapshots inv
JOIN tenants t ON inv.tenant_id = t.id
WHERE t.website_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Migrate competitor_snapshots (latest only)
INSERT INTO inventory_snapshots_unified (
  tenant_id,
  source_url,
  source_type,
  source_name,
  snapshot_date,
  scanned_at,
  vehicle_count,
  total_inventory_value,
  avg_price,
  min_price,
  max_price,
  avg_mileage,
  min_mileage,
  max_mileage,
  make_distribution,
  scraping_duration_ms,
  status,
  error_message,
  created_at
)
SELECT 
  NULL,
  competitor_url,
  'competitor',
  competitor_name,
  DATE(scanned_at),
  scanned_at,
  vehicle_count,
  total_inventory_value,
  avg_price,
  min_price,
  max_price,
  avg_mileage,
  min_mileage,
  max_mileage,
  top_makes,
  scraping_duration_ms,
  status,
  error_message,
  scanned_at
FROM competitor_snapshots
ON CONFLICT DO NOTHING;

-- 6. Migrate competitor_scan_history
INSERT INTO inventory_snapshots_unified (
  tenant_id,
  source_url,
  source_type,
  source_name,
  snapshot_date,
  scanned_at,
  vehicle_count,
  avg_price,
  total_inventory_value,
  make_distribution,
  created_at
)
SELECT 
  NULL,
  competitor_url,
  'competitor',
  competitor_name,
  DATE(scanned_at),
  scanned_at,
  vehicle_count,
  avg_price,
  total_inventory_value,
  top_makes,
  scanned_at
FROM competitor_scan_history
ON CONFLICT DO NOTHING;
