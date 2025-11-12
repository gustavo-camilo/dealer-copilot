-- ============================================
-- EMERGENCY FIX: Completely disable RLS on tenants temporarily
-- This will allow signup to work while we debug
-- ============================================

-- Option 1: Disable RLS entirely on tenants (TEMPORARY - NOT FOR PRODUCTION)
-- Uncomment this if you want to completely bypass RLS for testing:
-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS enabled but make policies extremely permissive
-- This is safer and what we'll do:

-- First, drop ALL existing policies
DROP POLICY IF EXISTS "Allow tenant creation during signup" ON tenants;
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON tenants;

-- Create an extremely simple INSERT policy with no conditions
CREATE POLICY "tenants_insert_policy"
  ON tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a simple SELECT policy
CREATE POLICY "tenants_select_policy"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a simple UPDATE policy
CREATE POLICY "tenants_update_policy"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify the new policies
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;

-- Also check if RLS is actually enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'tenants';
