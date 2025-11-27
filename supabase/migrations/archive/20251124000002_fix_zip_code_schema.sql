-- Ensure zip_code column exists (idempotent)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
