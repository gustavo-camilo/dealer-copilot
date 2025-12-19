-- Migration file: 20251128000001_fix_competitor_visibility.sql

-- Fix RLS policies for inventory_snapshots_unified to ensure tenants can see competitor data

-- 1. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Dealers can view own snapshots" ON inventory_snapshots_unified;
DROP POLICY IF EXISTS "Anyone can view competitor snapshots" ON inventory_snapshots_unified;
DROP POLICY IF EXISTS "Super admins can view all snapshots" ON inventory_snapshots_unified;
DROP POLICY IF EXISTS "System can manage snapshots" ON inventory_snapshots_unified;

-- 2. Re-create policies with broader visibility for competitors

-- Dealers/Tenants can view their own snapshots
CREATE POLICY "Dealers can view own snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE users.id = auth.uid()
    )
  );

-- Anyone (authenticated) can view competitor snapshots
-- We remove the strict "tenant_id IS NULL" check to be safe, 
-- and just rely on source_type = 'competitor'.
-- This ensures that even if a competitor snapshot accidentally has a tenant_id (or if we change that logic later),
-- it remains visible to all tenants.
CREATE POLICY "Anyone can view competitor snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    source_type = 'competitor'
  );

-- Super admins can view everything
CREATE POLICY "Super admins can view all snapshots"
  ON inventory_snapshots_unified FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- System roles (super_admin, va_uploader) can manage snapshots
CREATE POLICY "System can manage snapshots"
  ON inventory_snapshots_unified FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- 3. Ensure source_registry is also visible (it should be, but good to double check)
-- Existing policy "Authenticated users can view sources" is usually: USING (true)
-- We'll leave it as is, assuming it was set correctly in previous migrations.
-- If we need to be sure, we could recreate it, but let's stick to the snapshots for now.
