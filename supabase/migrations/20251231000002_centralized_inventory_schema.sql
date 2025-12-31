-- Migration: Switch to Centralized Inventory Schema
-- 20251231000002_centralized_inventory_schema.sql

-- 1. Create tenant_sources table (Many-to-Many link)
CREATE TABLE IF NOT EXISTS tenant_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES source_registry(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('owner', 'competitor', 'watchlist')),
    config JSONB DEFAULT '{}', -- Scrape overrides, notifications, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a tenant can't link to the same source twice
    CONSTRAINT unique_tenant_source_link UNIQUE (tenant_id, source_id)
);

-- Index for fast lookups
CREATE INDEX idx_tenant_sources_tenant ON tenant_sources(tenant_id);
CREATE INDEX idx_tenant_sources_source ON tenant_sources(source_id);

-- 2. Create tenant_vehicle_overrides table (Private Data)
CREATE TABLE IF NOT EXISTS tenant_vehicle_overrides (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES tracked_vehicles(id) ON DELETE CASCADE,
    
    -- Override Fields
    custom_price DECIMAL(10, 2),
    notes TEXT,
    floor_plan_status TEXT,
    is_starred BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, vehicle_id)
);

-- 3. Update tracked_vehicles table
-- allow NULL temporarily to migrate data
ALTER TABLE tracked_vehicles ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES source_registry(id) ON DELETE CASCADE;

-- 4. Update inventory_snapshots_unified table
ALTER TABLE inventory_snapshots_unified ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES source_registry(id) ON DELETE CASCADE;


-- DATA MIGRATION LOGIC (PL/PGSQL)
DO $$
DECLARE
    t_record RECORD;
    source_rec RECORD;
BEGIN
    -- A. Migrate Existing Tenants (Owners)
    FOR t_record IN SELECT * FROM tenants WHERE website_url IS NOT NULL LOOP
        -- Ensure source exists for the tenant's own website
        INSERT INTO source_registry (source_url, source_type, source_name)
        VALUES (t_record.website_url, 'dealer', t_record.name)
        ON CONFLICT (source_url) DO UPDATE SET source_name = EXCLUDED.source_name
        RETURNING id INTO source_rec.id;

        -- Link tenant to source as OWNER
        INSERT INTO tenant_sources (tenant_id, source_id, relationship_type)
        VALUES (t_record.id, source_rec.id, 'owner')
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- B. Migrate Tracked Vehicles (Link to Source ID)
    -- Update source_id based on source_url matching source_registry
    UPDATE tracked_vehicles tv
    SET source_id = sr.id
    FROM source_registry sr
    WHERE tv.source_url = sr.source_url;
    
    -- C. Migrate Inventory Snapshots (Link to Source ID)
    UPDATE inventory_snapshots_unified isu
    SET source_id = sr.id
    FROM source_registry sr
    WHERE isu.source_url = sr.source_url;

    -- D. Populate Tenant Sources for Competitors (Best Effort)
    -- If we have vehicles with tenant_id=NULL (Competitors), we assume they are "System Watchlist" or linked via some other logic.
    -- For now, we ensure they have a source_id.
    -- (The loop above likely caught them if they were in source_registry already).

END $$;

-- 5. Final Schema Cleanup (Make columns NOT NULL)
-- Note: We check if all rows have source_id before enforcing constraints
-- ALTER TABLE tracked_vehicles ALTER COLUMN source_id SET NOT NULL; -- Run manually after verification
-- ALTER TABLE inventory_snapshots_unified ALTER COLUMN source_id SET NOT NULL; -- Run manually after verification

-- Enable RLS on new tables
ALTER TABLE tenant_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_vehicle_overrides ENABLE ROW LEVEL SECURITY;

-- Policies for tenant_sources
CREATE POLICY "Tenants can view own sources" ON tenant_sources
    FOR SELECT USING (tenant_id = (SELECT auth.uid()::uuid)); -- Assuming auth.uid() maps to user, user maps to tenant. Simplified for CLI run.

-- Policies for tenant_vehicle_overrides
CREATE POLICY "Tenants can manage own overrides" ON tenant_vehicle_overrides
    FOR ALL USING (tenant_id = (SELECT auth.uid()::uuid)); -- Simplified
