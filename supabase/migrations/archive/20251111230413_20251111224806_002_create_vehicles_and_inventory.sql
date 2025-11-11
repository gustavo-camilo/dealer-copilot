/*
  # Vehicles and Inventory Management

  ## Overview
  Creates tables for vehicle tracking, inventory snapshots, and price history.

  ## New Tables
  
  ### `vehicles`
  - Complete vehicle tracking with tenant isolation
  
  ### `inventory_snapshots`
  - Historical inventory analytics per tenant
  
  ### `vehicle_price_history`
  - Time-series price tracking

  ## Security
  - Enable RLS on all tables
  - Tenants can only access their own vehicle data
  - Super admins can access all data
*/

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vin text NOT NULL,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  body_type text,
  engine text,
  transmission text,
  exterior_color text,
  interior_color text,
  mileage integer NOT NULL DEFAULT 0,
  price decimal(10, 2) NOT NULL,
  cost decimal(10, 2),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'pending', 'wholesaled')),
  title_status text DEFAULT 'clean' CHECK (title_status IN ('clean', 'salvage', 'rebuilt', 'unknown')),
  features jsonb DEFAULT '{}',
  images text[],
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  sold_at timestamptz,
  days_in_inventory integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, vin)
);

-- Create inventory_snapshots table
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_vehicles integer NOT NULL DEFAULT 0,
  total_value decimal(12, 2) NOT NULL DEFAULT 0,
  avg_price decimal(10, 2) NOT NULL DEFAULT 0,
  avg_mileage integer NOT NULL DEFAULT 0,
  avg_age decimal(4, 1) NOT NULL DEFAULT 0,
  avg_days_in_inventory integer NOT NULL DEFAULT 0,
  make_distribution jsonb DEFAULT '[]',
  model_distribution jsonb DEFAULT '[]',
  price_distribution jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, snapshot_date)
);

-- Create vehicle_price_history table
CREATE TABLE IF NOT EXISTS vehicle_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  vin text NOT NULL,
  price decimal(10, 2) NOT NULL,
  mileage integer NOT NULL,
  days_on_market integer NOT NULL DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(tenant_id, make, model);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant_date ON inventory_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_vehicle ON vehicle_price_history(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_tenant ON vehicle_price_history(tenant_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Users can view vehicles in their tenant"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert vehicles in their tenant"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can update vehicles in their tenant"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vehicles in their tenant"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'super_admin')
    )
  );

-- RLS Policies for inventory_snapshots
CREATE POLICY "Users can view snapshots in their tenant"
  ON inventory_snapshots FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "System can insert snapshots"
  ON inventory_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for vehicle_price_history
CREATE POLICY "Users can view price history in their tenant"
  ON vehicle_price_history FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "System can insert price history"
  ON vehicle_price_history FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate days in inventory
CREATE OR REPLACE FUNCTION calculate_days_in_inventory()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_in_inventory = EXTRACT(DAY FROM (now() - NEW.first_seen_at));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate days in inventory
CREATE TRIGGER calculate_vehicle_days_in_inventory
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_days_in_inventory();
