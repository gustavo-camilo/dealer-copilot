-- Extend vin_scans table with custom cost override columns
ALTER TABLE public.vin_scans
  ADD COLUMN IF NOT EXISTS custom_auction_fee_percent decimal(5,2),
  ADD COLUMN IF NOT EXISTS custom_recon_cost decimal(10,2),
  ADD COLUMN IF NOT EXISTS custom_transport_cost decimal(10,2),
  ADD COLUMN IF NOT EXISTS custom_max_bid decimal(10,2),
  ADD COLUMN IF NOT EXISTS custom_market_price decimal(10,2),
  ADD COLUMN IF NOT EXISTS costs_edited boolean DEFAULT false;

-- Add check constraints to ensure positive values
ALTER TABLE public.vin_scans
  ADD CONSTRAINT custom_auction_fee_percent_positive CHECK (custom_auction_fee_percent IS NULL OR custom_auction_fee_percent >= 0),
  ADD CONSTRAINT custom_recon_cost_positive CHECK (custom_recon_cost IS NULL OR custom_recon_cost >= 0),
  ADD CONSTRAINT custom_transport_cost_positive CHECK (custom_transport_cost IS NULL OR custom_transport_cost >= 0),
  ADD CONSTRAINT custom_max_bid_positive CHECK (custom_max_bid IS NULL OR custom_max_bid >= 0),
  ADD CONSTRAINT custom_market_price_positive CHECK (custom_market_price IS NULL OR custom_market_price >= 0);

-- Create index for finding scans with custom costs
CREATE INDEX IF NOT EXISTS idx_vin_scans_costs_edited ON public.vin_scans(costs_edited) WHERE costs_edited = true;

-- Add comments for documentation
COMMENT ON COLUMN public.vin_scans.custom_auction_fee_percent IS 'User-overridden auction fee percentage (overrides tenant default)';
COMMENT ON COLUMN public.vin_scans.custom_recon_cost IS 'User-overridden reconditioning cost (overrides tenant default)';
COMMENT ON COLUMN public.vin_scans.custom_transport_cost IS 'User-overridden transport cost (overrides tenant default)';
COMMENT ON COLUMN public.vin_scans.custom_max_bid IS 'User-overridden max bid amount (overrides calculated value)';
COMMENT ON COLUMN public.vin_scans.custom_market_price IS 'User-overridden market price (overrides API value)';
COMMENT ON COLUMN public.vin_scans.costs_edited IS 'Flag indicating if any costs were manually edited by the user';
