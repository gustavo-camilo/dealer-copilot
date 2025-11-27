/*
  # Make Competitor Data Global

  ## Overview
  Refactors competitor tables to be tenant-agnostic.
  This allows for a "Shared Data" model where one upload updates the data for ALL tenants tracking that competitor.

  ## Changes
  1. `competitor_vehicles`: Remove `tenant_id`, update Unique Constraint.
  2. `competitor_snapshots`: Remove `tenant_id`, update Unique Constraint.
  3. `competitor_scan_history`: Remove `tenant_id`.

  ## Migration Strategy
  - Drop existing tables (since they are new/empty or contain test data).
  - Re-create them without `tenant_id`.
*/

-- Drop existing tables to rebuild schema
DROP TABLE IF EXISTS public.competitor_vehicles;
DROP TABLE IF EXISTS public.competitor_snapshots;
DROP TABLE IF EXISTS public.competitor_scan_history;

-- 1. Re-create competitor_vehicles (Global)
CREATE TABLE public.competitor_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No tenant_id
  competitor_url text NOT NULL,
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  price decimal(10, 2),
  mileage integer,
  listing_url text,
  image_url text,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique per competitor + VIN
  UNIQUE(competitor_url, vin)
);

CREATE INDEX idx_competitor_vehicles_url ON public.competitor_vehicles(competitor_url);
CREATE INDEX idx_competitor_vehicles_vin ON public.competitor_vehicles(vin);

-- 2. Re-create competitor_snapshots (Global)
CREATE TABLE public.competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No tenant_id
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
  top_makes JSONB DEFAULT '{}',
  scraping_duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'partial', 'failed')) DEFAULT 'success',
  error_message TEXT,

  -- Unique per competitor URL
  CONSTRAINT unique_competitor_snapshot UNIQUE(competitor_url)
);

CREATE INDEX idx_competitor_snapshots_url ON public.competitor_snapshots(competitor_url);

-- 3. Re-create competitor_scan_history (Global)
CREATE TABLE public.competitor_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No tenant_id
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  vehicle_count INTEGER,
  avg_price DECIMAL(10, 2),
  total_inventory_value DECIMAL(12, 2),
  top_makes JSONB
);

CREATE INDEX idx_competitor_history_url ON public.competitor_scan_history(competitor_url);

-- Enable RLS
ALTER TABLE public.competitor_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_scan_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Global Read Access for Authenticated Users)
-- Any authenticated user (Tenant) can read ANY competitor data.
-- This is the "Shared Data" model. If you want to restrict it to "Only competitors I track",
-- we would need a more complex policy using the waiting_list table, but for now Global Read is simpler and faster.

CREATE POLICY "Authenticated users can view all competitor data"
  ON public.competitor_vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all competitor snapshots"
  ON public.competitor_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view all competitor history"
  ON public.competitor_scan_history FOR SELECT TO authenticated USING (true);

-- Write Access (System/Admins only)
CREATE POLICY "System can manage competitor data"
  ON public.competitor_vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'va_uploader')));

CREATE POLICY "System can manage competitor snapshots"
  ON public.competitor_snapshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'va_uploader')));

CREATE POLICY "System can manage competitor history"
  ON public.competitor_scan_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'va_uploader')));

-- Triggers
CREATE TRIGGER update_competitor_vehicles_updated_at
  BEFORE UPDATE ON public.competitor_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
