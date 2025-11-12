-- Migration: Add cost_settings to tenants table
-- Date: 2025-11-12
-- Description: Adds JSONB column to store dealer cost configuration settings

-- Add cost_settings column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS cost_settings JSONB DEFAULT '{
  "auction_fee_percent": 2,
  "reconditioning_cost": 800,
  "transport_cost": 150,
  "floor_plan_rate": 0.08,
  "target_margin_percent": 15,
  "target_days_to_sale": 30
}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN tenants.cost_settings IS 'JSON object storing dealer-specific cost configuration for profit calculations';

-- Optional: Update existing tenants with default values if they have null
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
