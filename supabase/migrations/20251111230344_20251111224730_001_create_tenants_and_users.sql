/*
  # Multi-Tenant Foundation: Tenants and Users

  ## Overview
  Creates the foundational tables for multi-tenant SaaS architecture with proper isolation.

  ## New Tables
  
  ### `tenants`
  - `id` (uuid, primary key) - Unique tenant identifier
  - `name` (text) - Dealership name
  - `website_url` (text, nullable) - Dealership website
  - `location` (text, nullable) - Physical address (will be auto-populated from website)
  - `contact_email` (text) - Primary contact email
  - `contact_phone` (text, nullable) - Contact phone number in +1 (XXX) XXX-XXXX format
  - `status` (text) - Account status: active, suspended, trial
  - `plan_type` (text) - Subscription plan: free, basic, pro, enterprise
  - `max_users` (integer) - Maximum allowed users
  - `max_vehicles` (integer) - Maximum vehicle tracking limit
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `users`
  - `id` (uuid, primary key) - References auth.users
  - `tenant_id` (uuid, foreign key) - Associated tenant
  - `email` (text, unique) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: super_admin, tenant_admin, tenant_user
  - `is_active` (boolean) - Account active status
  - `created_at` (timestamptz) - User creation timestamp
  - `last_login_at` (timestamptz, nullable) - Last login timestamp

  ## Security
  - Enable RLS on all tables
  - Allow public signup (authenticated users can create tenants during signup)
  - Tenants can only see their own data
  - Super admins can see all data
  - Users can only access their associated tenant's data
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website_url text,
  location text,
  contact_email text NOT NULL,
  contact_phone text,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  plan_type text NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise')),
  max_users integer NOT NULL DEFAULT 3,
  max_vehicles integer NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'tenant_user' CHECK (role IN ('super_admin', 'tenant_admin', 'tenant_user')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants table

-- Allow authenticated users to insert tenants during signup
CREATE POLICY "Authenticated users can insert tenants during signup"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Super admins can see all tenants
CREATE POLICY "Super admins can view all tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Tenant users can see their own tenant
CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Tenant admins can update their own tenant
CREATE POLICY "Tenant admins can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'super_admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'super_admin')
    )
  );

-- RLS Policies for users table

-- Allow authenticated users to insert their own user record during signup
CREATE POLICY "Users can insert own profile during signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Super admins can see all users
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Users can see users in their tenant
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Tenant admins can insert users in their tenant
CREATE POLICY "Tenant admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'super_admin')
    )
  );

-- Tenant admins can update users in their tenant
CREATE POLICY "Tenant admins can update users in their tenant"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('tenant_admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('tenant_admin', 'super_admin')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tenants updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
