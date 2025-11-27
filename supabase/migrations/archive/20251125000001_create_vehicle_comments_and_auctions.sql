-- Create auction_sources table
CREATE TABLE IF NOT EXISTS public.auction_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- Create vehicle_comments table
CREATE TABLE IF NOT EXISTS public.vehicle_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vin_scan_id UUID NOT NULL REFERENCES public.vin_scans(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    auction_source_id UUID REFERENCES public.auction_sources(id) ON DELETE SET NULL,
    auction_source_name TEXT, -- Denormalized for history preservation
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_auction_sources_tenant_id ON public.auction_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_comments_tenant_id ON public.vehicle_comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_comments_vin_scan_id ON public.vehicle_comments(vin_scan_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_comments_user_id ON public.vehicle_comments(user_id);

-- Enable RLS
ALTER TABLE public.auction_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auction_sources
CREATE POLICY "Users can view their tenant's auction sources"
    ON public.auction_sources FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Tenant admins can insert auction sources"
    ON public.auction_sources FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users
            WHERE id = auth.uid()
            AND role IN ('tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Tenant admins can update auction sources"
    ON public.auction_sources FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users
            WHERE id = auth.uid()
            AND role IN ('tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Tenant admins can delete auction sources"
    ON public.auction_sources FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users
            WHERE id = auth.uid()
            AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- RLS Policies for vehicle_comments
CREATE POLICY "Users can view their tenant's vehicle comments"
    ON public.vehicle_comments FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own vehicle comments"
    ON public.vehicle_comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own vehicle comments"
    ON public.vehicle_comments FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own vehicle comments"
    ON public.vehicle_comments FOR DELETE
    USING (user_id = auth.uid());

-- Insert default auction sources for existing tenants
INSERT INTO public.auction_sources (tenant_id, name, is_default, display_order)
SELECT
    id as tenant_id,
    unnest(ARRAY['ACV Auctions', 'Manheim', 'OpenLane', 'Others']) as name,
    unnest(ARRAY[false, false, false, false]) as is_default,
    unnest(ARRAY[1, 2, 3, 4]) as display_order
FROM public.tenants
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Create function to auto-insert default auction sources for new tenants
CREATE OR REPLACE FUNCTION public.insert_default_auction_sources()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.auction_sources (tenant_id, name, display_order)
    VALUES
        (NEW.id, 'ACV Auctions', 1),
        (NEW.id, 'Manheim', 2),
        (NEW.id, 'OpenLane', 3),
        (NEW.id, 'Others', 4)
    ON CONFLICT (tenant_id, name) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to insert default auction sources when a new tenant is created
DROP TRIGGER IF EXISTS trigger_insert_default_auction_sources ON public.tenants;
CREATE TRIGGER trigger_insert_default_auction_sources
    AFTER INSERT ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.insert_default_auction_sources();

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_auction_sources_updated_at ON public.auction_sources;
CREATE TRIGGER update_auction_sources_updated_at
    BEFORE UPDATE ON public.auction_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_comments_updated_at ON public.vehicle_comments;
CREATE TRIGGER update_vehicle_comments_updated_at
    BEFORE UPDATE ON public.vehicle_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
