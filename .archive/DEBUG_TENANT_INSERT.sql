-- ============================================
-- DEBUG: Test if we can insert into tenants table manually
-- ============================================

-- First, check if RLS is enabled
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'tenants';

-- Check current policies
SELECT
    policyname,
    cmd,
    permissive,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY cmd, policyname;

-- Try to insert a test tenant as an authenticated user would
-- This simulates what happens during signup
-- NOTE: This will fail if there's an issue with the policy

INSERT INTO tenants (
    name,
    contact_email,
    status,
    plan_type
) VALUES (
    'Test Tenant',
    'test@example.com',
    'trial',
    'free'
) RETURNING *;

-- If the above insert succeeded, delete the test record
DELETE FROM tenants WHERE contact_email = 'test@example.com';
