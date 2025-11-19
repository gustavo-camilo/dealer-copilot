-- =====================================================
-- FIX: Add missing columns to inventory_snapshots
-- =====================================================
-- The scraper expects these columns but they don't exist yet

-- Add status column for tracking scraping progress
ALTER TABLE inventory_snapshots
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'success', 'failed', 'partial'))
DEFAULT 'pending';

-- Add vehicles_found to track how many vehicles were scraped
ALTER TABLE inventory_snapshots
ADD COLUMN IF NOT EXISTS vehicles_found INTEGER DEFAULT 0;

-- Add scraping_duration_ms to track performance
ALTER TABLE inventory_snapshots
ADD COLUMN IF NOT EXISTS scraping_duration_ms INTEGER;

-- Add raw_data to store scraped vehicle data
ALTER TABLE inventory_snapshots
ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '[]';

-- Add error_message to track failures
ALTER TABLE inventory_snapshots
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_status
  ON inventory_snapshots(status);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant_date
  ON inventory_snapshots(tenant_id, created_at DESC);

-- Add comment
COMMENT ON COLUMN inventory_snapshots.status IS
  'Scraping status: pending (in progress), success (completed), failed (error), partial (some data collected)';

COMMENT ON COLUMN inventory_snapshots.vehicles_found IS
  'Number of vehicles found during this scraping run';

COMMENT ON COLUMN inventory_snapshots.raw_data IS
  'Raw vehicle data collected during scraping';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added missing columns to inventory_snapshots table';
  RAISE NOTICE '   - status (pending/success/failed/partial)';
  RAISE NOTICE '   - vehicles_found';
  RAISE NOTICE '   - scraping_duration_ms';
  RAISE NOTICE '   - raw_data';
  RAISE NOTICE '   - error_message';
END $$;
