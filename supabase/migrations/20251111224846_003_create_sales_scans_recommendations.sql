/*
  # Sales Tracking, VIN Scans, and Recommendations

  ## Overview
  Creates tables for sales records, VIN scan history, recommendations, and subscriptions.

  ## New Tables
  
  ### `sales_records`
  - `id` (uuid, primary key) - Unique sale identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `vehicle_id` (uuid, foreign key, nullable) - Associated vehicle if tracked
  - `vin` (text) - Vehicle VIN
  - `year` (integer) - Model year
  - `make` (text) - Manufacturer
  - `model` (text) - Model
  - `sale_price` (decimal) - Final sale price
  - `acquisition_cost` (decimal) - Total acquisition cost
  - `gross_profit` (decimal) - Calculated profit
  - `margin_percent` (decimal) - Profit margin percentage
  - `days_to_sale` (integer) - Days from acquisition to sale
  - `sale_date` (date) - Date of sale
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Record creation

  ### `vin_scans`
  - `id` (uuid, primary key) - Unique scan identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `user_id` (uuid, foreign key) - User who performed scan
  - `vin` (text) - Scanned VIN
  - `decoded_data` (jsonb) - Decoded vehicle data
  - `recommendation` (text) - Buy/caution/pass recommendation
  - `confidence_score` (integer) - Confidence percentage
  - `match_reasoning` (jsonb) - Why it matches or doesn't
  - `estimated_profit` (decimal, nullable) - Estimated profit
  - `max_bid_suggestion` (decimal, nullable) - Suggested max bid
  - `scan_location` (text, nullable) - Where scanned (auction name)
  - `saved_to_bid_list` (boolean) - Whether saved for bidding
  - `created_at` (timestamptz) - Scan timestamp

  ### `recommendations`
  - `id` (uuid, primary key) - Unique recommendation identifier
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `year_min` (integer) - Minimum year
  - `year_max` (integer) - Maximum year
  - `make` (text) - Manufacturer
  - `model` (text) - Model
  - `trim` (text, nullable) - Recommended trims
  - `target_price_min` (decimal) - Min acquisition price
  - `target_price_max` (decimal) - Max acquisition price
  - `target_mileage_max` (integer) - Max recommended mileage
  - `confidence_score` (integer) - Confidence percentage
  - `reasoning` (text) - Why recommended
  - `based_on_sales` (boolean) - Based on actual sales data
  - `avg_days_to_sale` (integer, nullable) - Historical performance
  - `avg_gross_profit` (decimal, nullable) - Historical profit
  - `priority` (integer) - Display priority (1=highest)
  - `is_active` (boolean) - Whether currently recommended
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update

  ### `subscriptions`
  - `id` (uuid, primary key) - Unique subscription identifier
  - `tenant_id` (uuid, foreign key, unique) - Associated tenant
  - `plan_type` (text) - Plan level
  - `status` (text) - Subscription status
  - `billing_interval` (text) - monthly/yearly
  - `amount` (decimal) - Subscription amount
  - `currency` (text) - Currency code
  - `current_period_start` (date) - Period start
  - `current_period_end` (date) - Period end
  - `trial_end` (date, nullable) - Trial end date
  - `stripe_customer_id` (text, nullable) - Stripe customer ID
  - `stripe_subscription_id` (text, nullable) - Stripe subscription ID
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update

  ## Security
  - Enable RLS on all tables
  - Tenants can only access their own data
  - Super admins can access all data
*/

-- Create sales_records table
CREATE TABLE IF NOT EXISTS sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vin text NOT NULL,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  sale_price decimal(10, 2) NOT NULL,
  acquisition_cost decimal(10, 2) NOT NULL,
  gross_profit decimal(10, 2) NOT NULL,
  margin_percent decimal(5, 2) NOT NULL,
  days_to_sale integer NOT NULL,
  sale_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create vin_scans table
CREATE TABLE IF NOT EXISTS vin_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vin text NOT NULL,
  decoded_data jsonb DEFAULT '{}',
  recommendation text NOT NULL CHECK (recommendation IN ('buy', 'caution', 'pass')),
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reasoning jsonb DEFAULT '[]',
  estimated_profit decimal(10, 2),
  max_bid_suggestion decimal(10, 2),
  scan_location text,
  saved_to_bid_list boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year_min integer NOT NULL,
  year_max integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  target_price_min decimal(10, 2) NOT NULL,
  target_price_max decimal(10, 2) NOT NULL,
  target_mileage_max integer NOT NULL,
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning text NOT NULL,
  based_on_sales boolean DEFAULT false,
  avg_days_to_sale integer,
  avg_gross_profit decimal(10, 2),
  priority integer DEFAULT 999,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  billing_interval text DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  amount decimal(10, 2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  current_period_start date NOT NULL,
  current_period_end date NOT NULL,
  trial_end date,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_records_tenant ON sales_records(tenant_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_records_make_model ON sales_records(tenant_id, make, model);
CREATE INDEX IF NOT EXISTS idx_vin_scans_tenant ON vin_scans(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vin_scans_user ON vin_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_tenant ON recommendations(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_active ON recommendations(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

-- Enable Row Level Security
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vin_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_records

CREATE POLICY "Users can view sales in their tenant"
  ON sales_records FOR SELECT
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

CREATE POLICY "Users can insert sales in their tenant"
  ON sales_records FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can update sales in their tenant"
  ON sales_records FOR UPDATE
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

-- RLS Policies for vin_scans

CREATE POLICY "Users can view scans in their tenant"
  ON vin_scans FOR SELECT
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

CREATE POLICY "Users can insert their own scans"
  ON vin_scans FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own scans"
  ON vin_scans FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for recommendations

CREATE POLICY "Users can view recommendations in their tenant"
  ON recommendations FOR SELECT
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

CREATE POLICY "System can manage recommendations"
  ON recommendations FOR ALL
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

-- RLS Policies for subscriptions

CREATE POLICY "Users can view their tenant subscription"
  ON subscriptions FOR SELECT
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

CREATE POLICY "Super admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate profit fields
CREATE OR REPLACE FUNCTION calculate_sale_profit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.gross_profit = NEW.sale_price - NEW.acquisition_cost;
  NEW.margin_percent = CASE 
    WHEN NEW.sale_price > 0 THEN (NEW.gross_profit / NEW.sale_price) * 100
    ELSE 0
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate profit
CREATE TRIGGER calculate_sales_profit
  BEFORE INSERT OR UPDATE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_profit();
