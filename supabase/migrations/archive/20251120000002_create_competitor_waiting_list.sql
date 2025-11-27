/*
  # Create Competitor Scraping Waiting List Table

  ## Overview
  Creates a table to manage the queue of competitor websites waiting for CSV upload and processing.
  Similar to scraping_waiting_list but specifically for competitor analysis.

  ## New Table: competitor_scraping_waiting_list
  - Tracks competitor URLs that need to be scraped
  - Manages workflow: pending -> in_progress -> completed
  - Links to tenant who requested the competitor analysis
  - Supports assignment to VA uploaders
  - Includes priority and notification tracking
*/

-- Create competitor_scraping_waiting_list table
CREATE TABLE IF NOT EXISTS public.competitor_scraping_waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_waiting_list_tenant
  ON public.competitor_scraping_waiting_list(tenant_id);

CREATE INDEX IF NOT EXISTS idx_competitor_waiting_list_status
  ON public.competitor_scraping_waiting_list(status);

CREATE INDEX IF NOT EXISTS idx_competitor_waiting_list_priority
  ON public.competitor_scraping_waiting_list(priority DESC, requested_at ASC);

-- Enable RLS
ALTER TABLE public.competitor_scraping_waiting_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Super admins and VA uploaders can view waiting list
CREATE POLICY "Super admins and VA uploaders can view competitor waiting list"
  ON public.competitor_scraping_waiting_list
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Tenants can view their own competitor requests
CREATE POLICY "Tenants can view their competitor requests"
  ON public.competitor_scraping_waiting_list
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE users.id = auth.uid()
    )
  );

-- Tenant admins and super admins can insert to waiting list
CREATE POLICY "Tenant admins can insert competitor requests"
  ON public.competitor_scraping_waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'super_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admins and VA uploaders can update waiting list
CREATE POLICY "Super admins and VA uploaders can update competitor waiting list"
  ON public.competitor_scraping_waiting_list
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Create trigger for updated_at on competitor_scraping_waiting_list
CREATE TRIGGER update_competitor_waiting_list_updated_at
  BEFORE UPDATE ON public.competitor_scraping_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.competitor_scraping_waiting_list IS
  'Manages the queue of competitor websites waiting for CSV upload and processing';

COMMENT ON COLUMN public.competitor_scraping_waiting_list.priority IS
  'Priority level: 1=low, 2=normal, 3=high, 4=urgent, 5=critical';

COMMENT ON COLUMN public.competitor_scraping_waiting_list.status IS
  'Workflow status: pending (not started), in_progress (being processed), completed (finished)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Created competitor_scraping_waiting_list table';
  RAISE NOTICE '   - Manages competitor scraping queue';
  RAISE NOTICE '   - Supports workflow: pending -> in_progress -> completed';
  RAISE NOTICE '   - Includes RLS policies for security';
END $$;
