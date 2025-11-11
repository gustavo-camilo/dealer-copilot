/*
  # Fix Security and Performance Issues

  ## Overview
  Addresses multiple security and performance concerns identified by Supabase:
  
  1. **Missing Foreign Key Index**
     - Add index on sales_records.vehicle_id for optimal join performance
  
  2. **RLS Performance Optimization**
     - Wrap auth function calls with SELECT to prevent re-evaluation per row
     - Affects multiple tables: users, vehicles, inventory_snapshots, etc.
  
  3. **Function Security**
     - Set immutable search_path on functions to prevent injection attacks
  
  ## Changes Made
  - Add missing foreign key index
  - Recreate all RLS policies with optimized auth function calls
  - Update function search paths for security
*/

-- ============================================
-- 1. ADD MISSING FOREIGN KEY INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_records_vehicle_id 
  ON sales_records(vehicle_id);

-- ============================================
-- 2. FIX FUNCTION SEARCH PATHS (Security)
-- ============================================

-- Update all functions to have immutable search_path
ALTER FUNCTION public.update_updated_at_column() 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.calculate_days_in_inventory() 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.calculate_sale_profit() 
  SET search_path = public, pg_temp;

-- ============================================
-- 3. OPTIMIZE RLS POLICIES - USERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Allow own profile creation" ON users;
DROP POLICY IF EXISTS "Users can view profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Tenant admins can create users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update tenant users" ON users;

-- Optimized policies with SELECT wrappers
CREATE POLICY "Allow own profile creation"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid()) 
    AND (
      tenant_id = (SELECT tenant_id FROM users WHERE id = (SELECT auth.uid()))
      OR (SELECT tenant_id FROM users WHERE id = (SELECT auth.uid())) IS NULL
    )
  );

CREATE POLICY "Tenant admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
    AND (SELECT public.get_user_role()) IN ('tenant_admin', 'super_admin')
  );

CREATE POLICY "Tenant admins can update tenant users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    AND (SELECT public.get_user_role()) IN ('tenant_admin', 'super_admin')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
    AND (SELECT public.get_user_role()) IN ('tenant_admin', 'super_admin')
  );

-- ============================================
-- 4. OPTIMIZE RLS POLICIES - VEHICLES TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view vehicles in their tenant" ON vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles in their tenant" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles in their tenant" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles in their tenant" ON vehicles;

CREATE POLICY "Users can view vehicles in their tenant"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "Users can insert vehicles in their tenant"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

CREATE POLICY "Users can update vehicles in their tenant"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

CREATE POLICY "Users can delete vehicles in their tenant"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 5. OPTIMIZE RLS POLICIES - INVENTORY_SNAPSHOTS
-- ============================================

DROP POLICY IF EXISTS "Users can view snapshots in their tenant" ON inventory_snapshots;
DROP POLICY IF EXISTS "System can insert snapshots" ON inventory_snapshots;

CREATE POLICY "Users can view snapshots in their tenant"
  ON inventory_snapshots FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "System can insert snapshots"
  ON inventory_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 6. OPTIMIZE RLS POLICIES - VEHICLE_PRICE_HISTORY
-- ============================================

DROP POLICY IF EXISTS "Users can view price history in their tenant" ON vehicle_price_history;
DROP POLICY IF EXISTS "System can insert price history" ON vehicle_price_history;

CREATE POLICY "Users can view price history in their tenant"
  ON vehicle_price_history FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "System can insert price history"
  ON vehicle_price_history FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 7. OPTIMIZE RLS POLICIES - SALES_RECORDS
-- ============================================

DROP POLICY IF EXISTS "Users can view sales in their tenant" ON sales_records;
DROP POLICY IF EXISTS "Users can insert sales in their tenant" ON sales_records;
DROP POLICY IF EXISTS "Users can update sales in their tenant" ON sales_records;

CREATE POLICY "Users can view sales in their tenant"
  ON sales_records FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "Users can insert sales in their tenant"
  ON sales_records FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

CREATE POLICY "Users can update sales in their tenant"
  ON sales_records FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 8. OPTIMIZE RLS POLICIES - VIN_SCANS
-- ============================================

DROP POLICY IF EXISTS "Users can view scans in their tenant" ON vin_scans;
DROP POLICY IF EXISTS "Users can insert their own scans" ON vin_scans;
DROP POLICY IF EXISTS "Users can update their own scans" ON vin_scans;

CREATE POLICY "Users can view scans in their tenant"
  ON vin_scans FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "Users can insert their own scans"
  ON vin_scans FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.get_user_tenant_id())
  );

CREATE POLICY "Users can update their own scans"
  ON vin_scans FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.get_user_tenant_id())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 9. OPTIMIZE RLS POLICIES - RECOMMENDATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view recommendations in their tenant" ON recommendations;
DROP POLICY IF EXISTS "System can manage recommendations" ON recommendations;

-- Combine into single policy to avoid multiple permissive policies warning
CREATE POLICY "Users can view recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

CREATE POLICY "Users can manage recommendations"
  ON recommendations FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
  );

-- ============================================
-- 10. OPTIMIZE RLS POLICIES - SUBSCRIPTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view their tenant subscription" ON subscriptions;
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions during signup" ON subscriptions;

-- Combine SELECT policies to avoid multiple permissive policies
CREATE POLICY "Users can view subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

-- Single INSERT policy
CREATE POLICY "Users can create subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.get_user_role()) = 'super_admin'
  );

-- UPDATE and DELETE for admins
CREATE POLICY "Admins can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_user_role()) = 'super_admin'
    OR (tenant_id = (SELECT public.get_user_tenant_id()) 
        AND (SELECT public.get_user_role()) = 'tenant_admin')
  )
  WITH CHECK (
    (SELECT public.get_user_role()) = 'super_admin'
    OR (tenant_id = (SELECT public.get_user_tenant_id()) 
        AND (SELECT public.get_user_role()) = 'tenant_admin')
  );
