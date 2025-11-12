-- =====================================================
-- DEALER CO-PILOT: WEBSITE SCRAPING DATABASE SCHEMA (FIXED)
-- =====================================================
-- Date: 2025-11-12
-- Purpose: Tables for tracking dealer inventory via website scraping
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Create New Query
-- 3. Copy and paste this entire script
-- 4. Click "Run"
-- =====================================================

-- =====================================================
-- TABLE 1: inventory_snapshots
-- Stores raw snapshots of dealer inventory from each scraping run
-- =====================================================

-- Drop existing table if it has issues (CAUTION: This deletes data!)
-- Uncomment next line ONLY if you want to start fresh:
-- DROP TABLE IF EXISTS inventory_snapshots CASCADE;

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  vehicles_found INTEGER DEFAULT 0,
  scraping_duration_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant
  ON inventory_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date
  ON inventory_snapshots(snapshot_date DESC);

-- =====================================================
-- TABLE 2: vehicle_history
-- Tracks individual vehicle listings over time
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vin TEXT,
  stock_number TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  price NUMERIC(10, 2),
  mileage INTEGER,
  exterior_color TEXT,
  listing_url TEXT,
  image_urls TEXT[],
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  price_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_history_tenant
  ON vehicle_history(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicle_history_vin
  ON vehicle_history(tenant_id, vin);
CREATE INDEX IF NOT EXISTS idx_vehicle_history_status
  ON vehicle_history(status, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_history_dates
  ON vehicle_history(first_seen_at, last_seen_at);

-- =====================================================
-- TABLE 3: scraping_logs
-- Detailed logs of scraping operations for debugging
-- =====================================================

CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES inventory_snapshots(id) ON DELETE CASCADE,
  log_level TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraping_logs_tenant
  ON scraping_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_snapshot
  ON scraping_logs(snapshot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_level
  ON scraping_logs(log_level, created_at DESC);

-- =====================================================
-- FUNCTION: Update sales_records when vehicle is marked as sold
-- =====================================================

CREATE OR REPLACE FUNCTION create_sales_record_from_vehicle_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create sales record if status changed to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    INSERT INTO sales_records (
      tenant_id,
      vehicle_id,
      vin,
      year,
      make,
      model,
      sale_price,
      days_to_sale,
      sale_date,
      notes
    ) VALUES (
      NEW.tenant_id,
      NEW.vehicle_id,
      NEW.vin,
      NEW.year,
      NEW.make,
      NEW.model,
      NEW.price,
      EXTRACT(DAY FROM (NEW.last_seen_at - NEW.first_seen_at))::INTEGER,
      NEW.last_seen_at,
      'Automatically detected via website scraping'
    )
    ON CONFLICT (vin, tenant_id)
    DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      days_to_sale = EXCLUDED.days_to_sale,
      sale_date = EXCLUDED.sale_date,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_create_sales_record ON vehicle_history;
CREATE TRIGGER trigger_create_sales_record
  AFTER UPDATE ON vehicle_history
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_record_from_vehicle_history();

-- =====================================================
-- FUNCTION: Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_vehicle_history_updated_at ON vehicle_history;
CREATE TRIGGER trigger_update_vehicle_history_updated_at
  BEFORE UPDATE ON vehicle_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenants can view own snapshots" ON inventory_snapshots;
DROP POLICY IF EXISTS "Service role can manage all snapshots" ON inventory_snapshots;
DROP POLICY IF EXISTS "Tenants can view own vehicle history" ON vehicle_history;
DROP POLICY IF EXISTS "Service role can manage all vehicle history" ON vehicle_history;
DROP POLICY IF EXISTS "Tenants can view own logs" ON scraping_logs;
DROP POLICY IF EXISTS "Service role can manage all logs" ON scraping_logs;

-- Policies for inventory_snapshots
CREATE POLICY "Tenants can view own snapshots"
  ON inventory_snapshots
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all snapshots"
  ON inventory_snapshots
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Policies for vehicle_history
CREATE POLICY "Tenants can view own vehicle history"
  ON vehicle_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all vehicle history"
  ON vehicle_history
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Policies for scraping_logs
CREATE POLICY "Tenants can view own logs"
  ON scraping_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all logs"
  ON scraping_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- Add unique constraint to sales_records to prevent duplicates
-- =====================================================

-- Check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_records_tenant_vin_unique'
  ) THEN
    ALTER TABLE sales_records
    ADD CONSTRAINT sales_records_tenant_vin_unique
    UNIQUE (tenant_id, vin);
  END IF;
END $$;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Website scraping database schema created successfully! ✅';
  RAISE NOTICE 'Tables created: inventory_snapshots, vehicle_history, scraping_logs';
  RAISE NOTICE 'Triggers created: automatic sales record creation';
  RAISE NOTICE 'Next step: Deploy the Edge Function';
END $$;

-- =====================================================
-- VERIFICATION QUERIES (Uncomment to run)
-- =====================================================

-- Check tables exist
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_name IN ('inventory_snapshots', 'vehicle_history', 'scraping_logs');

-- Check columns
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_snapshots';

-- Check triggers
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_table IN ('vehicle_history');
