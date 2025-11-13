-- =====================================================
-- FIX: Add DELETE policy for vehicle_history
-- =====================================================
-- Users currently can only SELECT their vehicle_history
-- but cannot DELETE. This migration adds the missing
-- DELETE policy so users can delete their own vehicles.

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Tenants can delete own vehicle history" ON vehicle_history;

-- Create DELETE policy for vehicle_history
CREATE POLICY "Tenants can delete own vehicle history"
  ON vehicle_history
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Also add INSERT and UPDATE policies for completeness
-- (these may be needed for future features)
DROP POLICY IF EXISTS "Tenants can insert own vehicle history" ON vehicle_history;
DROP POLICY IF EXISTS "Tenants can update own vehicle history" ON vehicle_history;

CREATE POLICY "Tenants can insert own vehicle history"
  ON vehicle_history
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own vehicle history"
  ON vehicle_history
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Vehicle history RLS policies updated!';
  RAISE NOTICE '';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  - SELECT (view) their own vehicle history';
  RAISE NOTICE '  - INSERT new vehicles';
  RAISE NOTICE '  - UPDATE existing vehicles';
  RAISE NOTICE '  - DELETE their own vehicles';
  RAISE NOTICE '';
END $$;
