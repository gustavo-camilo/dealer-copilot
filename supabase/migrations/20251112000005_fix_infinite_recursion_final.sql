/*
  # Fix Infinite Recursion in Users Table Policies - Final Fix

  ## Problem
  The UPDATE policy on the users table causes infinite recursion when trying to
  update last_login_at because the WITH CHECK clause queries the users table itself:

  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))

  This SELECT triggers the SELECT policy, which may trigger more queries, creating
  an infinite loop.

  ## Solution
  1. Drop the problematic "Users can update own profile" policy
  2. Create two separate policies:
     - One for users updating their own basic profile fields (no recursion)
     - One for admins updating other users
  3. Prevent tenant_id changes via a separate trigger (not in the policy)
  4. Use SECURITY DEFINER functions that bypass RLS
*/

-- First, ensure the helper functions exist and are correct
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

-- Drop all existing UPDATE policies on users table
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Tenant admins can update tenant users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users in their tenant" ON users;

-- Create a simple policy for users updating their own profile
-- No tenant_id check here to avoid recursion
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create a policy for tenant admins to update users in their tenant
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can update tenant users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
    AND id != auth.uid()  -- Admins updating others, not themselves
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() IN ('tenant_admin', 'super_admin')
    AND id != auth.uid()
  );

-- Protect tenant_id from being changed via a trigger
-- This prevents users from changing their own tenant_id
CREATE OR REPLACE FUNCTION public.protect_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow setting tenant_id if it was NULL (first time)
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id != OLD.tenant_id THEN
    -- Only super_admins can change tenant_id
    IF public.get_user_role() != 'super_admin' THEN
      RAISE EXCEPTION 'Cannot change tenant_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS protect_tenant_id_trigger ON users;

-- Create the trigger
CREATE TRIGGER protect_tenant_id_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_tenant_id();
