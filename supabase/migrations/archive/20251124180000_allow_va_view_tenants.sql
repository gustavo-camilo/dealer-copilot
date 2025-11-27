/*
  # Allow VA Uploaders to View Tenants

  ## Problem
  The "Users can view own tenant" policy on the `tenants` table restricts access to:
  1. Users viewing their own tenant (via `get_user_tenant_id()`)
  2. Super Admins

  This prevents `va_uploader` users from viewing tenant details. Since the `get-competitor-waiting-list`
  Edge Function performs an INNER JOIN on `tenants`, this causes the query to return no results for
  VA Uploaders (or any user who isn't a super admin or the specific tenant owner).

  ## Solution
  Update the policy to explicitly allow `va_uploader` role to view all tenants, similar to `super_admin`.
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;

-- Recreate the policy with va_uploader access
CREATE POLICY "Users can view own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own tenant
    id = (SELECT public.get_user_tenant_id())
    OR
    -- Super Admins AND VA Uploaders can view ALL tenants
    (SELECT public.get_user_role()) IN ('super_admin', 'va_uploader')
  );

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '✅ Updated tenants RLS policy to allow va_uploader access';
END $$;
