-- =====================================================
-- Competitor Snapshots Table
-- =====================================================
-- Stores quick snapshot analysis of competitor inventory
-- Only stores aggregated stats, not individual vehicles

CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Aggregated Stats
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  avg_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  total_inventory_value DECIMAL(12, 2),

  -- Top makes breakdown
  top_makes JSONB DEFAULT '{}',  -- {"Ford": 15, "Chevy": 12, "Toyota": 10}

  -- Metadata
  scraping_duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'partial', 'failed')) DEFAULT 'success',
  error_message TEXT,

  -- Only keep latest snapshot per competitor URL
  CONSTRAINT unique_competitor_per_tenant UNIQUE(tenant_id, competitor_url)
);

-- Index for efficient tenant queries
CREATE INDEX idx_competitor_snapshots_tenant
  ON competitor_snapshots(tenant_id, scanned_at DESC);

-- Index for URL lookups
CREATE INDEX idx_competitor_snapshots_url
  ON competitor_snapshots(competitor_url);

-- Add comment
COMMENT ON TABLE competitor_snapshots IS
  'Stores aggregated competitive intelligence snapshots. Each tenant can have one snapshot per competitor URL (upserted on rescan).';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Created competitor_snapshots table';
  RAISE NOTICE '   - Stores aggregated stats only (no individual vehicles)';
  RAISE NOTICE '   - One snapshot per competitor URL per tenant';
  RAISE NOTICE '   - Automatically updated on rescan (UPSERT)';
END $$;
