-- =====================================================
-- DEALER CO-PILOT: ENHANCED VEHICLE TRACKING
-- =====================================================
-- This migration adds:
-- 1. Listing date confidence tracking
-- 2. Sitemap caching for accurate date extraction
-- 3. Ensures sales_records creation when vehicles are marked as sold

-- =====================================================
-- 1. ADD LISTING DATE TRACKING TO VEHICLE_HISTORY
-- =====================================================

-- Add columns to track how we determined the listing date
ALTER TABLE vehicle_history
ADD COLUMN IF NOT EXISTS listing_date_confidence TEXT
  CHECK (listing_date_confidence IN ('high', 'medium', 'low', 'estimated'))
  DEFAULT 'estimated',
ADD COLUMN IF NOT EXISTS listing_date_source TEXT;
-- Sources: 'json_ld', 'meta_tag', 'sitemap', 'visible_text', 'http_header', 'first_scan'

COMMENT ON COLUMN vehicle_history.listing_date_confidence IS
  'Confidence level of first_seen_at accuracy: high (exact date), medium (within 1-2 days), low (within 1 week), estimated (unknown)';

COMMENT ON COLUMN vehicle_history.listing_date_source IS
  'Source of first_seen_at date: json_ld, meta_tag, sitemap, visible_text, http_header, first_scan';

-- Add index for querying by confidence
CREATE INDEX IF NOT EXISTS idx_vehicle_history_listing_confidence
  ON vehicle_history(listing_date_confidence);

-- =====================================================
-- 2. CREATE SITEMAP CACHE TABLE
-- =====================================================
-- Caches sitemap.xml data to avoid repeated fetches
-- Refreshed once per day during scheduled scraping

CREATE TABLE IF NOT EXISTS sitemap_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  url_dates JSONB NOT NULL DEFAULT '{}', -- { "/inventory/vin-123": "2025-11-01", ... }
  total_urls INTEGER DEFAULT 0,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  fetch_status TEXT DEFAULT 'success', -- 'success', 'not_found', 'error'
  error_message TEXT,
  UNIQUE(tenant_id)
);

COMMENT ON TABLE sitemap_cache IS
  'Caches sitemap.xml data for each tenant to extract accurate listing dates without repeated HTTP requests';

COMMENT ON COLUMN sitemap_cache.url_dates IS
  'JSON object mapping URL paths to their lastmod dates from sitemap.xml';

CREATE INDEX IF NOT EXISTS idx_sitemap_cache_tenant
  ON sitemap_cache(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sitemap_cache_expires
  ON sitemap_cache(expires_at);

-- =====================================================
-- 3. ENSURE SALES_RECORDS TABLE HAS NULLABLE FIELDS
-- =====================================================
-- Allow null for fields we can't determine from scraping

-- Check if sales_records exists and modify constraints
DO $$
BEGIN
  -- Make acquisition_cost nullable (we don't know this from scraping)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_records'
    AND column_name = 'acquisition_cost'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sales_records
      ALTER COLUMN acquisition_cost DROP NOT NULL;
  END IF;

  -- Make gross_profit nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_records'
    AND column_name = 'gross_profit'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sales_records
      ALTER COLUMN gross_profit DROP NOT NULL;
  END IF;

  -- Make margin_percent nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_records'
    AND column_name = 'margin_percent'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sales_records
      ALTER COLUMN margin_percent DROP NOT NULL;
  END IF;
END $$;

-- Add index for sales records by date (for analytics)
CREATE INDEX IF NOT EXISTS idx_sales_records_sale_date
  ON sales_records(tenant_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_records_vin
  ON sales_records(vin);

-- =====================================================
-- 4. ADD TRIGGER TO AUTO-CREATE SALES RECORDS
-- =====================================================
-- When vehicle_history status changes to 'sold',
-- automatically create a sales_record

CREATE OR REPLACE FUNCTION create_sales_record_from_vehicle()
RETURNS TRIGGER AS $$
DECLARE
  days_listed INTEGER;
BEGIN
  -- Only trigger when status changes TO 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN

    -- Calculate days listed
    days_listed := EXTRACT(EPOCH FROM (NOW() - NEW.first_seen_at)) / 86400;

    -- Create sales record
    INSERT INTO sales_records (
      tenant_id,
      vehicle_id,
      vin,
      year,
      make,
      model,
      sale_price,
      acquisition_cost,
      gross_profit,
      margin_percent,
      days_to_sale,
      sale_date
    ) VALUES (
      NEW.tenant_id,
      NEW.vehicle_id,
      NEW.vin,
      NEW.year,
      NEW.make,
      NEW.model,
      NEW.price,  -- Last known listing price
      NULL,       -- Unknown from scraping
      NULL,       -- Can't calculate without acquisition cost
      NULL,       -- Can't calculate without acquisition cost
      days_listed,
      CURRENT_DATE
    )
    ON CONFLICT (vin, tenant_id, sale_date) DO NOTHING; -- Prevent duplicates
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_create_sales_record ON vehicle_history;

CREATE TRIGGER trigger_create_sales_record
  AFTER UPDATE ON vehicle_history
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_record_from_vehicle();

COMMENT ON FUNCTION create_sales_record_from_vehicle IS
  'Automatically creates a sales_record when a vehicle status changes to sold';

-- =====================================================
-- 5. ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE SALES
-- =====================================================
-- Ensure we don't create duplicate sales records for the same vehicle

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_records_unique_sale
  ON sales_records(tenant_id, vin, sale_date);

-- =====================================================
-- 6. CREATE HELPER VIEWS FOR ANALYTICS
-- =====================================================

-- View: Vehicles with high-confidence listing dates
CREATE OR REPLACE VIEW vehicles_with_accurate_dates AS
SELECT
  vh.*,
  t.name as tenant_name,
  EXTRACT(EPOCH FROM (NOW() - vh.first_seen_at)) / 86400 as days_listed
FROM vehicle_history vh
JOIN tenants t ON vh.tenant_id = t.id
WHERE vh.listing_date_confidence IN ('high', 'medium')
  AND vh.status = 'active';

COMMENT ON VIEW vehicles_with_accurate_dates IS
  'Active vehicles with high or medium confidence listing dates, useful for accurate analytics';

-- View: Recent sales with complete data
CREATE OR REPLACE VIEW recent_sales_summary AS
SELECT
  sr.*,
  t.name as tenant_name,
  vh.listing_date_confidence,
  vh.listing_date_source,
  CASE
    WHEN sr.acquisition_cost IS NOT NULL
    THEN sr.sale_price - sr.acquisition_cost
    ELSE NULL
  END as calculated_profit
FROM sales_records sr
JOIN tenants t ON sr.tenant_id = t.id
LEFT JOIN vehicle_history vh ON sr.vin = vh.vin AND sr.tenant_id = vh.tenant_id
WHERE sr.sale_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY sr.sale_date DESC;

COMMENT ON VIEW recent_sales_summary IS
  'Sales from last 90 days with associated tenant and listing date confidence data';

-- =====================================================
-- 7. ADD ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE sitemap_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tenant's sitemap cache
CREATE POLICY sitemap_cache_tenant_isolation ON sitemap_cache
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::uuid);

-- Policy: Service role can see all
CREATE POLICY sitemap_cache_service_role ON sitemap_cache
  FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Enhanced vehicle tracking migration complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 New Features:';
  RAISE NOTICE '  1. Listing date confidence tracking (high/medium/low/estimated)';
  RAISE NOTICE '  2. Sitemap caching for accurate date extraction';
  RAISE NOTICE '  3. Automatic sales_records creation via trigger';
  RAISE NOTICE '  4. Helper views for analytics';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 The scraper will now:';
  RAISE NOTICE '  - Extract listing dates from multiple sources';
  RAISE NOTICE '  - Cache sitemap data (refreshed daily)';
  RAISE NOTICE '  - Automatically create sales records when vehicles are marked sold';
  RAISE NOTICE '';
END $$;
