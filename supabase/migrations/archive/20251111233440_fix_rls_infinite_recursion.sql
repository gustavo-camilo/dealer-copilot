/*
  # Fix Infinite Recursion in RLS Policies

  ## Problem
  The current RLS policies create infinite recursion by querying the `users` table
  within policies that protect the `users` table itself.

  ## Solution
  1. Drop all existing policies that cause recursion
  2. Create simpler policies that don't self-reference
  3. Use direct auth.uid() checks instead of subqueries where possible
  4. For tenant isolation, use security definer functions to break recursion

  ## Changes
  - Drop problematic policies on users and tenants tables
  - Create helper functions to get user's tenant_id and role without recursion
  - Recreate policies using the helper functions
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can insert tenants during signup" ON tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;

DROP POLICY IF EXISTS "Users can insert own profile during signup" ON users;
DROP POLICY IF EXISTS "Super admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Tenant admins can insert users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users in their tenant" ON users;

-- Create security definer functions to get user's tenant_id and role
-- These bypass RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Tenants table policies (simplified)

-- Allow authenticated users to insert tenants during signup
CREATE POLICY "Allow tenant creation during signup"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can view their own tenant or all tenants if super_admin
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = public.get_user_tenant_id()
    OR public.get_user_role() = 'super_admin'
  );

-- Tenant admins can update their tenant
CREATE POLICY "Tenant admins can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
  )
  WITH CHECK (
    id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
  );

-- Users table policies (simplified)

-- Allow users to insert their own profile during signup
CREATE POLICY "Allow own profile creation"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can view themselves, users in their tenant, or all users if super_admin
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR tenant_id = public.get_user_tenant_id()
    OR public.get_user_role() = 'super_admin'
  );

-- Users can update their own profile (but not change tenant_id)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND tenant_id = public.get_user_tenant_id());

-- Tenant admins can insert users in their tenant
CREATE POLICY "Tenant admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
  );

-- Tenant admins can update users in their tenant
CREATE POLICY "Tenant admins can update tenant users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
  );
