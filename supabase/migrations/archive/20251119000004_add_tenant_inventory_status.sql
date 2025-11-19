-- Add inventory status tracking to tenants table
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS inventory_status text DEFAULT 'pending' CHECK (inventory_status IN ('pending', 'processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS inventory_ready_at timestamptz;

-- Create index for querying by inventory status
CREATE INDEX IF NOT EXISTS idx_tenants_inventory_status ON public.tenants(inventory_status);

-- Update existing tenants that have vehicle_history data to 'ready' status
UPDATE public.tenants t
SET
  inventory_status = 'ready',
  inventory_ready_at = (
    SELECT MIN(created_at)
    FROM public.vehicle_history vh
    WHERE vh.tenant_id = t.id
  )
WHERE EXISTS (
  SELECT 1 FROM public.vehicle_history vh
  WHERE vh.tenant_id = t.id
);

-- Add comments for documentation
COMMENT ON COLUMN public.tenants.inventory_status IS 'Status of inventory scraping: pending (not started), processing (in progress), ready (completed), failed (error occurred)';
COMMENT ON COLUMN public.tenants.inventory_ready_at IS 'Timestamp when inventory first became ready for tenant access';
