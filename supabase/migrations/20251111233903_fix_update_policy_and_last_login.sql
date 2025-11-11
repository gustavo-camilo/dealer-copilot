/*
  # Fix UPDATE Policy for last_login_at

  ## Problem
  The UPDATE policy prevents users from updating their last_login_at timestamp
  because the WITH CHECK clause requires tenant_id to match, but during login
  the tenant_id might not be properly set yet.

  ## Solution
  1. Simplify the "Users can update own profile" policy
  2. Allow users to update their own profile without tenant_id check in WITH CHECK
  3. Keep tenant_id immutable by checking it hasn't changed
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Recreate with simpler logic
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND (
      -- Allow updating if tenant_id hasn't changed
      tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
      OR 
      -- Or if this is the first time setting tenant_id (was NULL)
      (SELECT tenant_id FROM users WHERE id = auth.uid()) IS NULL
    )
  );
