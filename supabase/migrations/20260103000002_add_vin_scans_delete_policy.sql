-- Migration: Add DELETE policy for vin_scans table
-- This fixes the ERR_CONNECTION_CLOSED error when performing operations on vin_scans

-- Add DELETE policy for vin_scans
CREATE POLICY "Users can delete their own scans"
  ON vin_scans FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.get_user_tenant_id())
  );
