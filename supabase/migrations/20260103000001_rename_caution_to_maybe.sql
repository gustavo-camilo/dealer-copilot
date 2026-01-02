-- Migration: Rename 'caution' recommendation to 'maybe'
-- This migration updates the vin_scans table to replace the 'caution' recommendation
-- with 'maybe' throughout the system

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE vin_scans
  DROP CONSTRAINT IF EXISTS vin_scans_recommendation_check;

-- Step 2: Update existing data (backward compatibility)
-- Migrate all existing 'caution' recommendations to 'maybe'
UPDATE vin_scans
  SET recommendation = 'maybe'
  WHERE recommendation = 'caution';

-- Step 3: Add new CHECK constraint with 'maybe' instead of 'caution'
ALTER TABLE vin_scans
  ADD CONSTRAINT vin_scans_recommendation_check
  CHECK (recommendation IN ('buy', 'maybe', 'pass'));
