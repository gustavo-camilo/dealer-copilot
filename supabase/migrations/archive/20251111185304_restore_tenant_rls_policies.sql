/*
  # Restore Missing Tenant RLS Policies

  ## Problem
  The previous migration (20251111234752_fix_security_and_performance_issues.sql)
  dropped the tenant RLS policies but did NOT recreate them, causing tenant
  creation to fail during signup with:
  "new row violates row-level security policy for table 'tenants'"

  ## Solution
  Restore the tenant RLS policies with optimized SELECT wrappers for performance.

  ## Changes
  - Recreate INSERT policy to allow tenant creation during signup
  - Recreate SELECT policy for users to view their own tenant
  - Recreate UPDATE policy for tenant admins
*/

-- ============================================
-- RESTORE TENANT RLS POLICIES
-- ============================================

-- Drop any existing policies first (in case they exist)
DROP POLICY IF EXISTS "Allow tenant creation during signup" ON tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON tenants;

-- Allow authenticated users to insert tenants during signup
-- This is critical for the signup flow to work
CREATE POLICY "Allow tenant creation during signup"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can view their own tenant or all tenants if super_admin
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

-- Tenant admins can update their tenant
CREATE POLICY "Tenant admins can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT public.get_user_tenant_id())
    AND (SELECT public.get_user_role()) IN ('tenant_admin', 'super_admin')
  )
  WITH CHECK (
    id = (SELECT public.get_user_tenant_id())
    AND (SELECT public.get_user_role()) IN ('tenant_admin', 'super_admin')
  );
