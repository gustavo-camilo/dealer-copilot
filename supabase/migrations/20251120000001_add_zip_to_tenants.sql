/*
  # Add ZIP Code to Tenants Table

  ## Overview
  Adds a dedicated zip_code column to the tenants table for better data structure
  and easier querying. Migrates existing ZIP codes from the location field.

  ## Changes
  - Add zip_code VARCHAR(10) column to tenants table
  - Extract and migrate existing ZIP codes from location field (format: "City, State (12345)")
  - Add index for efficient ZIP code queries
*/

-- Add zip_code column to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);

-- Migrate existing location data (extract ZIP from "City, State (12345)" format)
UPDATE public.tenants
SET zip_code = substring(location from '\((\d{5})\)$')
WHERE location ~ '\(\d{5}\)$' AND zip_code IS NULL;

-- Create index for ZIP code queries
CREATE INDEX IF NOT EXISTS idx_tenants_zip_code ON public.tenants(zip_code);

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.zip_code IS 'Postal ZIP code for the dealership location';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added zip_code column to tenants table';
  RAISE NOTICE '   - Migrated existing ZIP codes from location field';
  RAISE NOTICE '   - Added index for efficient queries';
END $$;
