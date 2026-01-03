-- Migration: Add purchase tracking and auction URL to VIN scans
-- Adds purchase_status, purchase_price, purchase_date, and auction_url fields

-- Step 1: Add new columns
ALTER TABLE vin_scans
  ADD COLUMN IF NOT EXISTS auction_url TEXT,
  ADD COLUMN IF NOT EXISTS purchase_status TEXT DEFAULT 'not_purchased',
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ;

-- Step 2: Add CHECK constraint for purchase_status
ALTER TABLE vin_scans
  ADD CONSTRAINT vin_scans_purchase_status_check
  CHECK (purchase_status IN ('purchased', 'not_purchased'));

-- Step 3: Add CHECK constraint for purchase_price (must be positive if set)
ALTER TABLE vin_scans
  ADD CONSTRAINT vin_scans_purchase_price_positive
  CHECK (purchase_price IS NULL OR purchase_price >= 0);

-- Step 4: Create index for filtering purchased vehicles
CREATE INDEX IF NOT EXISTS idx_vin_scans_purchase_status
  ON vin_scans(tenant_id, purchase_status, created_at DESC);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN vin_scans.auction_url IS 'Direct URL to the vehicle listing in the auction (per-VIN URL)';
COMMENT ON COLUMN vin_scans.purchase_status IS 'Whether vehicle was purchased: purchased or not_purchased';
COMMENT ON COLUMN vin_scans.purchase_price IS 'Actual purchase price if vehicle was purchased';
COMMENT ON COLUMN vin_scans.purchase_date IS 'Date when vehicle was marked as purchased';
