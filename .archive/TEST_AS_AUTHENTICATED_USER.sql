-- ============================================
-- TEST: Simulate what happens during actual signup
-- This tests INSERT as an authenticated user would experience it
-- ============================================

-- Create a test user to simulate signup
-- (We'll delete this after testing)
DO $$
DECLARE
    test_user_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Try to insert a tenant AS IF we were an authenticated user
    -- We use SET LOCAL to simulate the JWT role
    SET LOCAL role TO authenticated;
    SET LOCAL request.jwt.claims TO json_build_object(
        'sub', test_user_id::text,
        'role', 'authenticated'
    )::text;

    -- Now try the insert
    INSERT INTO tenants (
        name,
        contact_email,
        status,
        plan_type
    ) VALUES (
        'Test Tenant RLS',
        'rlstest@example.com',
        'trial',
        'free'
    );

    RAISE NOTICE 'SUCCESS: Insert worked!';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- Clean up test data
DELETE FROM tenants WHERE contact_email = 'rlstest@example.com';

-- Reset role
RESET role;
