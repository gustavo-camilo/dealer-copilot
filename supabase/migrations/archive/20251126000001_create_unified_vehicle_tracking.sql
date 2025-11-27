-- Migration file: 20251126000001_create_unified_vehicle_tracking.sql

-- 1. Create tracked_vehicles table
CREATE TABLE tracked_vehicles (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership model (CRITICAL for multi-tenancy)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = competitor vehicle (global)
    -- NOT NULL = dealer vehicle (tenant-scoped)
  
  source_url TEXT NOT NULL,
    -- For dealers: their website URL (from tenants.website_url)
    -- For competitors: competitor website URL
    -- This is the grouping identifier for all vehicles
  
  source_type TEXT NOT NULL CHECK (source_type IN ('dealer', 'competitor')),
    -- 'dealer' = tenant-owned vehicle
    -- 'competitor' = global competitor vehicle
  
  -- Vehicle identification
  vin TEXT,
  stock_number TEXT,
  listing_url TEXT,
  
  -- Vehicle attributes
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  price DECIMAL(10, 2),
  mileage INTEGER,
  exterior_color TEXT,
  
  -- Images (store first image only for performance)
  image_url TEXT,
  
  -- Lifecycle tracking
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
  
  -- Listing date confidence (from sitemap analysis)
  listing_date_confidence TEXT 
    CHECK (listing_date_confidence IN ('high', 'medium', 'low', 'estimated'))
    DEFAULT 'estimated',
  listing_date_source TEXT,
    -- 'json_ld', 'meta_tag', 'sitemap', 'visible_text', 'http_header', 'first_scan'
  
  -- Price history (JSONB for simplicity)
  price_history JSONB DEFAULT '[]',
    -- [{"date": "2025-11-01", "price": 25000}, ...]
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key relationship (optional - link to vehicles table)
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    -- Only set for dealer vehicles that exist in manual entry
  
  -- Unique constraints
  CONSTRAINT unique_dealer_vehicle 
    UNIQUE NULLS NOT DISTINCT (tenant_id, source_url, vin),
    -- For dealer vehicles: unique per tenant + source + VIN
    -- For competitor vehicles: unique per source + VIN
  
  CONSTRAINT unique_competitor_vehicle 
    UNIQUE (source_url, vin)
    -- Ensures global uniqueness for competitor vehicles (when tenant_id is NULL)
);

-- Add partial unique index for competitor vehicles to enforce uniqueness only when tenant_id is NULL
-- Note: The constraint above might not fully cover "WHERE tenant_id IS NULL" in standard SQL without partial index or specific syntax support depending on PG version, 
-- but "UNIQUE NULLS NOT DISTINCT" handles the NULL tenant_id case as a distinct value group if we treat it that way. 
-- However, to be safe and explicit as per plan:
DROP INDEX IF EXISTS unique_competitor_vehicle_idx;
CREATE UNIQUE INDEX unique_competitor_vehicle_idx ON tracked_vehicles (source_url, vin) WHERE tenant_id IS NULL;


-- Indexes for performance
CREATE INDEX idx_tracked_vehicles_tenant 
  ON tracked_vehicles(tenant_id, status, last_seen_at DESC) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_tracked_vehicles_source 
  ON tracked_vehicles(source_url, status, last_seen_at DESC);

CREATE INDEX idx_tracked_vehicles_vin 
  ON tracked_vehicles(vin) 
  WHERE vin IS NOT NULL;

CREATE INDEX idx_tracked_vehicles_type 
  ON tracked_vehicles(source_type, status);

CREATE INDEX idx_tracked_vehicles_dates 
  ON tracked_vehicles(first_seen_at, last_seen_at);

CREATE INDEX idx_tracked_vehicles_make_model 
  ON tracked_vehicles(make, model, year);

-- Partial index for active dealer vehicles (hot path)
CREATE INDEX idx_tracked_vehicles_active_dealer 
  ON tracked_vehicles(tenant_id, last_seen_at DESC) 
  WHERE status = 'active' AND source_type = 'dealer';

-- Partial index for active competitor vehicles
CREATE INDEX idx_tracked_vehicles_active_competitor 
  ON tracked_vehicles(source_url, last_seen_at DESC) 
  WHERE status = 'active' AND source_type = 'competitor' AND tenant_id IS NULL;


-- 2. Create inventory_snapshots_unified table
CREATE TABLE inventory_snapshots_unified (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership model (same as tracked_vehicles)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = competitor snapshot (global)
    -- NOT NULL = dealer snapshot (tenant-scoped)
  
  source_url TEXT NOT NULL,
    -- For dealers: their website URL
    -- For competitors: competitor website URL
  
  source_type TEXT NOT NULL CHECK (source_type IN ('dealer', 'competitor')),
  
  source_name TEXT,
    -- For dealers: tenant name (from tenants.name)
    -- For competitors: competitor name (user-provided or derived from URL)
  
  -- Snapshot metadata
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Aggregated statistics (UNIFIED FIELD NAMES)
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  total_inventory_value DECIMAL(12, 2),
  
  -- Price statistics
  avg_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  
  -- Mileage statistics
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  
  -- Age statistics (dealer only - requires first_seen_at)
  avg_days_in_inventory INTEGER,
  avg_vehicle_age DECIMAL(4, 1),
  
  -- Distribution data (UNIFIED FIELD NAME)
  make_distribution JSONB DEFAULT '{}',
    -- {"Ford": 15, "Chevrolet": 12, "Toyota": 10}
  
  model_distribution JSONB DEFAULT '{}',
    -- {"F-150": 8, "Silverado": 7, "Camry": 5}
  
  price_distribution JSONB DEFAULT '{}',
    -- {"0-20k": 10, "20k-40k": 25, "40k+": 15}
  
  -- Scraping metadata
  scraping_duration_ms INTEGER,
  status TEXT CHECK (status IN ('pending', 'success', 'partial', 'failed')) DEFAULT 'success',
  error_message TEXT,
  raw_data JSONB,
    -- Store raw vehicle data if needed for debugging
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraints
  -- For dealers: one snapshot per tenant per date
  CONSTRAINT unique_dealer_snapshot 
    UNIQUE (tenant_id, snapshot_date), 
    -- Note: This constraint implicitly requires tenant_id to be NOT NULL if we want it to work as expected for dealers only, 
    -- but since we have NULLs for competitors, we should use a partial index or rely on the application logic + RLS.
    -- Better to use partial unique index:
    
  -- For competitors: one snapshot per source per date
  CONSTRAINT unique_competitor_snapshot 
    UNIQUE (source_url, snapshot_date)
);

-- Fix unique constraints with partial indexes for clarity and correctness
ALTER TABLE inventory_snapshots_unified DROP CONSTRAINT IF EXISTS unique_dealer_snapshot;
ALTER TABLE inventory_snapshots_unified DROP CONSTRAINT IF EXISTS unique_competitor_snapshot;

CREATE UNIQUE INDEX unique_dealer_snapshot_idx 
  ON inventory_snapshots_unified (tenant_id, snapshot_date) 
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX unique_competitor_snapshot_idx 
  ON inventory_snapshots_unified (source_url, snapshot_date) 
  WHERE tenant_id IS NULL;


-- Indexes
CREATE INDEX idx_snapshots_unified_tenant 
  ON inventory_snapshots_unified(tenant_id, snapshot_date DESC) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_snapshots_unified_source 
  ON inventory_snapshots_unified(source_url, snapshot_date DESC);

CREATE INDEX idx_snapshots_unified_type 
  ON inventory_snapshots_unified(source_type, snapshot_date DESC);

CREATE INDEX idx_snapshots_unified_date 
  ON inventory_snapshots_unified(snapshot_date DESC);

-- Partial index for latest snapshots (hot path)
CREATE INDEX idx_snapshots_unified_latest 
  ON inventory_snapshots_unified(source_url, scanned_at DESC) 
  WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days';


-- 3. Create source_registry table
CREATE TABLE source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_url TEXT UNIQUE NOT NULL,
    -- Normalized URL (lowercase, no trailing slash)
  
  source_type TEXT NOT NULL CHECK (source_type IN ('dealer', 'competitor')),
  
  source_name TEXT,
    -- Friendly name
  
  -- Tenant association
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = competitor
    -- NOT NULL = dealer (this is the tenant's own website)
  
  -- Scraping configuration
  scraping_enabled BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  next_scheduled_scrape TIMESTAMPTZ,
  scraping_frequency_hours INTEGER DEFAULT 24,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Migration tracking
  migrated_from_competitor_at TIMESTAMPTZ,
    -- Set when a competitor becomes a tenant
  original_competitor_url TEXT
    -- If migrated, stores the original competitor URL
);

CREATE INDEX idx_source_registry_url ON source_registry(source_url);
CREATE INDEX idx_source_registry_tenant ON source_registry(tenant_id);
CREATE INDEX idx_source_registry_type ON source_registry(source_type);
CREATE INDEX idx_source_registry_scraping ON source_registry(scraping_enabled, next_scheduled_scrape);


-- 4. Enable RLS and create policies

-- tracked_vehicles RLS
ALTER TABLE tracked_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own vehicles"
  ON tracked_vehicles FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view competitor vehicles"
  ON tracked_vehicles FOR SELECT
  TO authenticated
  USING (
    source_type = 'competitor' AND tenant_id IS NULL
  );

CREATE POLICY "Super admins can view all vehicles"
  ON tracked_vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "System can manage dealer vehicles"
  ON tracked_vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

CREATE POLICY "System can manage competitor vehicles"
  ON tracked_vehicles FOR ALL
  TO authenticated
  USING (
    source_type = 'competitor'
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- inventory_snapshots_unified RLS
ALTER TABLE inventory_snapshots_unified ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view competitor snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    source_type = 'competitor' AND tenant_id IS NULL
  );

CREATE POLICY "Super admins can view all snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "System can manage snapshots"
  ON inventory_snapshots_unified FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- source_registry RLS
ALTER TABLE source_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sources"
  ON source_registry FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage sources"
  ON source_registry FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );


-- 5. Create helper views for backward compatibility
-- MOVED TO 20251126000004_switch_to_unified_views.sql to avoid name conflicts with existing tables

