-- Create manual_scraping_uploads table to track CSV uploads
CREATE TABLE IF NOT EXISTS public.manual_scraping_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  filename text NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT NOW(),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'pending_review')),
  vehicles_processed integer DEFAULT 0,
  vehicles_new integer DEFAULT 0,
  vehicles_updated integer DEFAULT 0,
  vehicles_sold integer DEFAULT 0,
  error_log jsonb,
  raw_csv_data text, -- Store original CSV for re-processing if needed
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Create scraping_waiting_list table to track tenants waiting for initial scraping
CREATE TABLE IF NOT EXISTS public.scraping_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  website_url text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 1,
  notes text,
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_manual_scraping_uploads_tenant ON public.manual_scraping_uploads(tenant_id);
CREATE INDEX idx_manual_scraping_uploads_status ON public.manual_scraping_uploads(status);
CREATE INDEX idx_manual_scraping_uploads_date ON public.manual_scraping_uploads(upload_date DESC);
CREATE INDEX idx_scraping_waiting_list_status ON public.scraping_waiting_list(status);
CREATE INDEX idx_scraping_waiting_list_priority ON public.scraping_waiting_list(priority DESC, requested_at ASC);

-- Enable RLS
ALTER TABLE public.manual_scraping_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_waiting_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manual_scraping_uploads
-- Super admins can see all uploads
CREATE POLICY "Super admins can view all uploads"
  ON public.manual_scraping_uploads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- VA uploaders can see their own uploads
CREATE POLICY "VA uploaders can view their uploads"
  ON public.manual_scraping_uploads
  FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Tenants can see uploads for their dealership
CREATE POLICY "Tenants can view their uploads"
  ON public.manual_scraping_uploads
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE users.id = auth.uid()
    )
  );

-- Super admins and VA uploaders can insert uploads
CREATE POLICY "Super admins and VA uploaders can insert uploads"
  ON public.manual_scraping_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Super admins can update uploads
CREATE POLICY "Super admins can update uploads"
  ON public.manual_scraping_uploads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for scraping_waiting_list
-- Super admins and VA uploaders can view waiting list
CREATE POLICY "Super admins and VA uploaders can view waiting list"
  ON public.scraping_waiting_list
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Super admins can insert to waiting list
CREATE POLICY "Super admins can insert to waiting list"
  ON public.scraping_waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admins and VA uploaders can update waiting list
CREATE POLICY "Super admins and VA uploaders can update waiting list"
  ON public.scraping_waiting_list
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'va_uploader')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on manual_scraping_uploads
CREATE TRIGGER update_manual_scraping_uploads_updated_at
  BEFORE UPDATE ON public.manual_scraping_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.manual_scraping_uploads IS 'Tracks all manual CSV uploads for vehicle scraping data';
COMMENT ON TABLE public.scraping_waiting_list IS 'Manages the queue of tenants waiting for initial inventory scraping';
COMMENT ON COLUMN public.manual_scraping_uploads.raw_csv_data IS 'Stores the original CSV content for re-processing if needed';
COMMENT ON COLUMN public.scraping_waiting_list.priority IS 'Higher values indicate higher priority (1=normal, 5=urgent)';
