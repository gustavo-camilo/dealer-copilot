-- Check what policies currently exist on the tenants table
SELECT
    policyname,
    cmd,
    CASE
        WHEN with_check::text = 'true' THEN '✓ Allows all authenticated users'
        ELSE with_check::text
    END as policy_rule
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY cmd, policyname;
