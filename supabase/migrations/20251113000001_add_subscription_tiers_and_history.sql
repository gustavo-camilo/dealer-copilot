-- =====================================================
-- Add Subscription Tiers and Competitor Scan History
-- =====================================================
-- This migration adds subscription tier tracking to tenants
-- and creates a history table for competitor scans

-- Add subscription_tier to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'starter' CHECK (
  subscription_tier IN ('starter', 'professional', 'enterprise')
);

-- Add comment to document the tiers
COMMENT ON COLUMN tenants.subscription_tier IS 'Subscription tier: starter, professional, or enterprise. Controls feature access including competitor scan history.';

-- Update existing tenants to default tier
UPDATE tenants
SET subscription_tier = 'starter'
WHERE subscription_tier IS NULL;

-- =====================================================
-- Competitor Scan History Table
-- =====================================================
-- Stores historical competitor scans for Enterprise tier
-- Allows tracking of competitor changes over time

CREATE TABLE competitor_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Aggregated Stats (same as competitor_snapshots)
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  avg_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  total_inventory_value DECIMAL(12, 2),

  -- Top makes breakdown
  top_makes JSONB DEFAULT '{}',

  -- Metadata
  scraping_duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'partial', 'failed')) DEFAULT 'success',
  error_message TEXT,

  -- Index for efficient queries
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient tenant + URL queries
CREATE INDEX idx_competitor_history_tenant_url
  ON competitor_scan_history(tenant_id, competitor_url, scanned_at DESC);

-- Index for date-based queries
CREATE INDEX idx_competitor_history_scanned_at
  ON competitor_scan_history(scanned_at DESC);

-- Add comment
COMMENT ON TABLE competitor_scan_history IS
  'Stores historical competitor scan data for Enterprise tier customers. Allows tracking changes over time.';

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE competitor_scan_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own tenant's scan history
-- Uses SECURITY DEFINER function to avoid any potential recursion issues
CREATE POLICY "Users can view own tenant scan history"
  ON competitor_scan_history
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

-- Policy: Users can insert scan history for their own tenant
-- Uses SECURITY DEFINER function to avoid any potential recursion issues
CREATE POLICY "Users can insert own tenant scan history"
  ON competitor_scan_history
  FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Policy: Users can delete their own tenant's scan history
-- Uses SECURITY DEFINER function to avoid any potential recursion issues
CREATE POLICY "Users can delete own tenant scan history"
  ON competitor_scan_history
  FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- =====================================================
-- Success Message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Subscription tiers and scan history setup complete!';
  RAISE NOTICE '   - Added subscription_tier column to tenants table';
  RAISE NOTICE '   - Created competitor_scan_history table';
  RAISE NOTICE '   - Configured RLS policies for scan history';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Subscription Tiers:';
  RAISE NOTICE '   - starter: Basic competitor scanning (no history)';
  RAISE NOTICE '   - professional: Enhanced features';
  RAISE NOTICE '   - enterprise: Full history and advanced analytics';
END $$;
