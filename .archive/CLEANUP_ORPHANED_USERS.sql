-- ============================================
-- DELETE ORPHANED AUTH USERS
-- Run this ONLY after fixing RLS policies
-- ============================================

-- This will delete users from auth.users that don't have
-- corresponding profiles in public.users
-- These users will need to sign up again (with working RLS policies)

-- WARNING: This is irreversible. The users will be deleted.
-- They will need to sign up again with new passwords.

DELETE FROM auth.users
WHERE id IN (
    '31d42f66-d9f4-480a-80f4-092f65aca15f',
    'adb0d5b3-9a90-40c4-b2a0-de098b639b52',
    'b7d5bf2e-5ea9-43ab-a6db-1edf8b491ec3',
    'b75cb249-f7f4-41e4-8415-8d0d01b2501b'
);

-- Verify they're deleted
SELECT count(*) as deleted_count
FROM auth.users
WHERE id IN (
    '31d42f66-d9f4-480a-80f4-092f65aca15f',
    'adb0d5b3-9a90-40c4-b2a0-de098b639b52',
    'b7d5bf2e-5ea9-43ab-a6db-1edf8b491ec3',
    'b75cb249-f7f4-41e4-8415-8d0d01b2501b'
);
-- Should return 0
