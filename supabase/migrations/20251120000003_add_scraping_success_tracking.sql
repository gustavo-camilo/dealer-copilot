/*
  # Add Scraping Success Tracking

  ## Overview
  Enhances the manual_scraping_uploads table to track both manual uploads and automated scraping successes.
  Adds a source column to distinguish between dealer inventory scraping and competitor data uploads.

  ## Changes
  - Add scraping_source column to manual_scraping_uploads table
  - Create function to log successful automated scrapes
  - This enables unified scraping history tracking in the admin panel
*/

-- Add scraping_source column to manual_scraping_uploads
ALTER TABLE public.manual_scraping_uploads
ADD COLUMN IF NOT EXISTS scraping_source TEXT DEFAULT 'dealer_inventory'
CHECK (scraping_source IN ('dealer_inventory', 'competitor_data'));

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_manual_scraping_uploads_source
  ON public.manual_scraping_uploads(scraping_source);

-- Add comment for documentation
COMMENT ON COLUMN public.manual_scraping_uploads.scraping_source IS
  'Source type: dealer_inventory (dealer website scraping) or competitor_data (competitor CSV upload)';

-- Function to log successful automated scrapes
CREATE OR REPLACE FUNCTION log_successful_scrape(
  p_tenant_id UUID,
  p_vehicles_count INTEGER,
  p_source TEXT DEFAULT 'dealer_inventory'
) RETURNS VOID AS $$
DECLARE
  v_uploader_id UUID;
BEGIN
  -- Get a super_admin user ID for the uploaded_by field
  SELECT id INTO v_uploader_id
  FROM public.users
  WHERE role = 'super_admin'
  LIMIT 1;

  -- If no super_admin exists, try to get any admin for the tenant
  IF v_uploader_id IS NULL THEN
    SELECT id INTO v_uploader_id
    FROM public.users
    WHERE tenant_id = p_tenant_id AND role IN ('tenant_admin', 'super_admin')
    LIMIT 1;
  END IF;

  -- Insert the automated scrape record
  INSERT INTO public.manual_scraping_uploads (
    tenant_id,
    uploaded_by,
    filename,
    upload_date,
    status,
    vehicles_processed,
    scraping_source
  ) VALUES (
    p_tenant_id,
    v_uploader_id,
    'Automated Scrape',
    NOW(),
    'completed',
    p_vehicles_count,
    p_source
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_successful_scrape TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION log_successful_scrape IS
  'Logs a successful automated scrape to the manual_scraping_uploads table for unified history tracking';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added scraping success tracking';
  RAISE NOTICE '   - Added scraping_source column to manual_scraping_uploads';
  RAISE NOTICE '   - Created log_successful_scrape() function';
  RAISE NOTICE '   - Enables unified scraping history in admin panel';
END $$;
