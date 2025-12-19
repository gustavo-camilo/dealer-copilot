-- ============================================================
-- ADD REFRESH REQUEST TRACKING TO SOURCE REGISTRY
-- ============================================================
--
-- This migration adds fields to track tenant refresh requests
-- for competitor intelligence updates.
--
-- New Fields:
-- - is_refresh_pending: Boolean flag for pending refresh
-- - refresh_requested_at: Timestamp when refresh was requested
-- - refresh_requested_by: User ID who requested the refresh
--
-- ============================================================

-- Add refresh request tracking fields to source_registry
ALTER TABLE source_registry
ADD COLUMN IF NOT EXISTS is_refresh_pending BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS refresh_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_requested_by UUID REFERENCES auth.users(id);

-- Add index for efficient pending request queries
CREATE INDEX IF NOT EXISTS idx_source_registry_refresh_pending
  ON source_registry(is_refresh_pending, source_type)
  WHERE is_refresh_pending = true;

-- Add comments for documentation
COMMENT ON COLUMN source_registry.is_refresh_pending IS 'True if a refresh request is pending admin action';
COMMENT ON COLUMN source_registry.refresh_requested_at IS 'Timestamp when a refresh was last requested by a tenant';
COMMENT ON COLUMN source_registry.refresh_requested_by IS 'User ID who requested the refresh';

-- Recreate scraping_queue_view to include refresh request fields
DROP VIEW IF EXISTS scraping_queue_view CASCADE;

CREATE OR REPLACE VIEW scraping_queue_view AS
SELECT
  sr.id,
  sr.source_url,
  sr.source_type,
  sr.source_name,
  sr.tenant_id,
  t.name as tenant_name,
  sr.status,
  sr.priority,
  sr.notes,
  sr.assigned_to,
  au.email as assigned_user_email,
  au.raw_user_meta_data->>'full_name' as assigned_user_name,
  sr.created_at as requested_at,
  sr.updated_at,
  sr.last_scraped_at,
  sr.next_scheduled_scrape,
  sr.is_refresh_pending,
  sr.refresh_requested_at,
  ru.raw_user_meta_data->>'full_name' as refresh_requested_by_name
FROM source_registry sr
LEFT JOIN tenants t ON sr.tenant_id = t.id
LEFT JOIN auth.users au ON sr.assigned_to = au.id
LEFT JOIN auth.users ru ON sr.refresh_requested_by = ru.id;

-- Set default values for existing sources
UPDATE source_registry
SET
  is_refresh_pending = false,
  refresh_requested_at = NULL,
  refresh_requested_by = NULL
WHERE is_refresh_pending IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Refresh request tracking added to source_registry';
  RAISE NOTICE '';
  RAISE NOTICE 'New fields:';
  RAISE NOTICE '  - is_refresh_pending: Track pending refresh requests';
  RAISE NOTICE '  - refresh_requested_at: When refresh was requested';
  RAISE NOTICE '  - refresh_requested_by: Who requested the refresh';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated scraping_queue_view to include refresh fields';
END $$;
