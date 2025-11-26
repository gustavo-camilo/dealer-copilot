/*
  # Add DELETE Policies for Waiting Lists

  ## Overview
  Adds RLS policies to allow super_admin to delete entries from both waiting list tables

  ## Changes
  - Add DELETE policy for competitor_scraping_waiting_list
  - Add DELETE policy for scraping_waiting_list
*/

-- Super admins can delete competitor waiting list entries
CREATE POLICY "Super admins can delete competitor waiting list entries"
  ON public.competitor_scraping_waiting_list
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admins can delete scraping waiting list entries
CREATE POLICY "Super admins can delete scraping waiting list entries"
  ON public.scraping_waiting_list
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added DELETE policies for waiting lists';
  RAISE NOTICE '   - Super admins can now delete competitor requests';
  RAISE NOTICE '   - Super admins can now delete dealer inventory requests';
END $$;
