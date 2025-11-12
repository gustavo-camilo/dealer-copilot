-- ============================================
-- COMPREHENSIVE FIX FOR RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check current policies on tenants table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;

-- Step 2: Drop all existing tenant policies to start fresh
DROP POLICY IF EXISTS "Allow tenant creation during signup" ON tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON tenants;
DROP POLICY IF EXISTS "Authenticated users can insert tenants during signup" ON tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;

-- Step 3: Recreate the INSERT policy (CRITICAL FOR SIGNUP)
-- This allows ANY authenticated user to create a tenant during signup
CREATE POLICY "Allow tenant creation during signup"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 4: Recreate SELECT policy
-- Users can view their own tenant or all tenants if super_admin
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

-- Step 5: Recreate UPDATE policy
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

-- Step 6: Verify policies were created successfully
SELECT
    policyname,
    cmd,
    CASE
        WHEN with_check::text = 'true' THEN 'WITH CHECK: true (allows all)'
        ELSE 'WITH CHECK: ' || with_check::text
    END as policy_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;

-- Step 7: Clean up orphaned auth users (users without profiles)
-- This finds users in auth.users that don't have a corresponding record in public.users
SELECT
    au.id,
    au.email,
    au.created_at,
    'Orphaned - no profile in public.users' as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- If you want to delete these orphaned users, uncomment and run this:
-- WARNING: This will permanently delete users from auth.users
-- DELETE FROM auth.users
-- WHERE id IN (
--     SELECT au.id
--     FROM auth.users au
--     LEFT JOIN public.users pu ON au.id = pu.id
--     WHERE pu.id IS NULL
-- );
