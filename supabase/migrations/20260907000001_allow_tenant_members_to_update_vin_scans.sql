-- Migration: Allow any member of a tenant to update that tenant's VIN scans
--
-- Problem:
--   The SELECT policy on vin_scans is tenant-scoped, but the UPDATE policy also
--   required user_id = auth.uid(). A user could therefore open a colleague's scan,
--   edit the profit calculator and press Save, but the UPDATE matched zero rows.
--   PostgREST reports a zero-row UPDATE as 200 with an empty result rather than an
--   error, so the app showed "Costs saved successfully" while the change was
--   silently discarded — the values reverted to defaults on the next page load.
--
-- Fix:
--   Align UPDATE with SELECT: scope it to the tenant.
--
-- Security notes:
--   - USING is tenant-scoped, so no cross-tenant row ever becomes updatable.
--   - WITH CHECK repeats the tenant predicate, so a row cannot be moved into
--     another tenant by rewriting tenant_id.
--   - The super_admin escape hatch present in the SELECT policy is deliberately
--     NOT added here; this migration grants no privilege beyond tenant membership.
--   - INSERT and DELETE policies are unchanged.

DROP POLICY IF EXISTS "Users can update their own scans" ON vin_scans;
DROP POLICY IF EXISTS "Users can update scans in their tenant" ON vin_scans;

CREATE POLICY "Users can update scans in their tenant"
  ON vin_scans FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );
