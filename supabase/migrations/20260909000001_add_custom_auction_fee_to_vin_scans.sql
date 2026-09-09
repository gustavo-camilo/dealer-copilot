-- Migration: Store per-vehicle auction fee overrides on vin_scans
--
-- Problem:
--   The profit calculator lets the user edit the auction fee, but that value was
--   never persisted: ProfitCalculator held it in local state seeded to null, it was
--   absent from the onSave payload, and handleSaveCosts never wrote it. On reload
--   the fee fell back to calculateAuctionFee() from the tenant's threshold table,
--   which also reset every derived figure (total investment, gross profit, margin,
--   ROI) — so a saved calculation appeared to revert to default numbers.
--
-- Why a new column:
--   vin_scans already has custom_auction_fee_percent decimal(5,2), but the UI edits
--   a flat dollar amount, and decimal(5,2) caps at 999.99 — any fee of $1000 or more
--   would fail on write. The existing column is left untouched rather than
--   repurposed, since its name documents a different meaning.
--
-- NULL means "no override": derive the fee from the tenant's thresholds as before.

ALTER TABLE public.vin_scans
  ADD COLUMN IF NOT EXISTS custom_auction_fee decimal(10,2);

ALTER TABLE public.vin_scans
  DROP CONSTRAINT IF EXISTS custom_auction_fee_positive;

ALTER TABLE public.vin_scans
  ADD CONSTRAINT custom_auction_fee_positive
  CHECK (custom_auction_fee IS NULL OR custom_auction_fee >= 0);

COMMENT ON COLUMN public.vin_scans.custom_auction_fee IS
  'User-overridden auction fee in dollars (NULL = derive from tenant auction_fee_thresholds)';
