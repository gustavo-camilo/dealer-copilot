-- Fix RLS policy to allow VA uploaders to insert into waiting list
-- This is needed because the get-waiting-list function auto-creates missing entries
-- and VA uploaders need to be able to call this function

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Super admins can insert to waiting list" ON public.scraping_waiting_list;

-- Create new policy that allows both super_admins and va_uploaders to insert
CREATE POLICY "Super admins and VA uploaders can insert to waiting list"
  ON public.scraping_waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

COMMENT ON POLICY "Super admins and VA uploaders can insert to waiting list" ON public.scraping_waiting_list
  IS 'Allows super admins and VA uploaders to add tenants to the waiting list. This is required for the get-waiting-list function to auto-create missing entries.';
