-- =====================================================
-- FIX: Change inventory_snapshots unique constraint
-- =====================================================
-- Allow multiple scrapes per day by removing the unique constraint
-- on snapshot_date and using created_at timestamp instead

-- Drop the old unique constraint
ALTER TABLE inventory_snapshots
DROP CONSTRAINT IF EXISTS inventory_snapshots_tenant_id_snapshot_date_key;

-- The snapshot_date column can remain for backward compatibility,
-- but we'll rely on created_at (with timestamp) for uniqueness
-- This allows multiple scrapes per day

-- Add comment explaining the change
COMMENT ON TABLE inventory_snapshots IS
  'Tracks each inventory scraping run. Multiple snapshots per day are allowed to enable frequent updates and manual re-scans.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Removed unique constraint on inventory_snapshots';
  RAISE NOTICE '   - Multiple scrapes per day are now allowed';
  RAISE NOTICE '   - Each scrape creates a new snapshot record';
END $$;
