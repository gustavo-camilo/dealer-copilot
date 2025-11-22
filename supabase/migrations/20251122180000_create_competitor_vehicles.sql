/*
  # Create Competitor Vehicles Table

  ## Overview
  Creates a table to store individual competitor vehicles.
  This allows for granular analysis and tracking of specific competitor inventory over time.

  ## New Table: competitor_vehicles
  - `id` (uuid, primary key)
  - `tenant_id` (uuid, foreign key) - The tenant tracking this vehicle
  - `competitor_url` (text) - The competitor's website URL (grouping identifier)
  - `vin` (text) - Vehicle Identification Number
  - `year` (integer)
  - `make` (text)
  - `model` (text)
  - `trim` (text)
  - `price` (decimal)
  - `mileage` (integer)
  - `listing_url` (text) - URL to the specific vehicle listing
  - `image_url` (text)
  - `first_seen_at` (timestamptz)
  - `last_seen_at` (timestamptz)
  - `status` (text) - 'active', 'sold'
*/

CREATE TABLE IF NOT EXISTS public.competitor_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competitor_url text NOT NULL,
  vin text, -- Nullable because some competitor sites might not show VIN
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
  
  -- Unique constraint to prevent duplicates (per tenant, per competitor, per VIN/URL)
  -- If VIN is present, it should be unique per competitor. If not, rely on listing_url.
  UNIQUE(tenant_id, competitor_url, vin)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_competitor_vehicles_tenant ON public.competitor_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_competitor_vehicles_competitor ON public.competitor_vehicles(competitor_url);
CREATE INDEX IF NOT EXISTS idx_competitor_vehicles_vin ON public.competitor_vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_competitor_vehicles_status ON public.competitor_vehicles(status);

-- Enable RLS
ALTER TABLE public.competitor_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Super admins can view all
CREATE POLICY "Super admins can view all competitor vehicles"
  ON public.competitor_vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Tenants can view their own competitor vehicles
CREATE POLICY "Tenants can view their own competitor vehicles"
  ON public.competitor_vehicles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE users.id = auth.uid()
    )
  );

-- System (and admins/VAs) can insert/update
CREATE POLICY "System and admins can manage competitor vehicles"
  ON public.competitor_vehicles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_competitor_vehicles_updated_at
  BEFORE UPDATE ON public.competitor_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.competitor_vehicles IS 'Stores individual vehicles from competitor websites for analysis.';
