-- =====================================================
-- DEALER CO-PILOT: VIN DECODER DATABASE MIGRATION
-- =====================================================
-- Date: 2025-11-12
-- Purpose: Add cost_settings to tenants table for VIN decoder functionality
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New Query"
-- 5. Copy and paste this entire SQL script
-- 6. Click "Run" or press Cmd/Ctrl + Enter
-- =====================================================

-- Add cost_settings column to tenants table
-- This stores dealer-specific cost configuration for profit calculations
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS cost_settings JSONB;

-- Add comment to document the column structure
COMMENT ON COLUMN tenants.cost_settings IS 'JSON object storing dealer cost configuration:
{
  "auction_fee_percent": 2,          -- Auction fee as percentage (e.g., 2 = 2%)
  "reconditioning_cost": 800,        -- Average reconditioning cost per vehicle ($)
  "transport_cost": 150,             -- Average transport cost per vehicle ($)
  "floor_plan_rate": 0.08,           -- Annual floor plan interest rate (e.g., 0.08 = 8%)
  "target_margin_percent": 15,       -- Target profit margin percentage (e.g., 15 = 15%)
  "target_days_to_sale": 30          -- Target days to sale (used for inventory planning)
}';

-- Set default values for existing tenants that don't have cost_settings
UPDATE tenants
SET cost_settings = '{
  "auction_fee_percent": 2,
  "reconditioning_cost": 800,
  "transport_cost": 150,
  "floor_plan_rate": 0.08,
  "target_margin_percent": 15,
  "target_days_to_sale": 30
}'::jsonb
WHERE cost_settings IS NULL;

-- =====================================================
-- VERIFICATION QUERIES (Run these to verify migration)
-- =====================================================

-- Check that column was added successfully
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'tenants' AND column_name = 'cost_settings';

-- View all tenants with their cost settings
-- SELECT id, name, cost_settings
-- FROM tenants
-- ORDER BY created_at DESC;

-- =====================================================
-- ROLLBACK SCRIPT (In case you need to undo this)
-- =====================================================
-- ALTER TABLE tenants DROP COLUMN IF EXISTS cost_settings;
-- =====================================================
