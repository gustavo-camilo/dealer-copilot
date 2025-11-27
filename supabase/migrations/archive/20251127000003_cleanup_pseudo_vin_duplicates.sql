/*
  Fix Pseudo-VIN Duplicates: Clean Up Duplicate Vehicles

  ## Purpose
  Removes duplicate vehicles where the same vehicle exists with both a real VIN and a pseudo-VIN.
  This was caused by non-deterministic pseudo-VIN generation using row index instead of listing URL.

  ## Strategy
  For each duplicate pair (identified by Make/Model/Year):
  1. Keep the vehicle with the REAL VIN (valid format)
  2. Delete the vehicle with the PSEUDO_* VIN

  ## Context
  Previous uploads created vehicles with different VINs for the same physical vehicle.
  The pseudo-VIN function now uses listing_url for determinism, preventing future duplicates.
*/

DO $$
DECLARE
    duplicate_record RECORD;
    real_vin_id UUID;
    pseudo_vin_id UUID;
    deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Cleaning Pseudo-VIN Duplicates ===';
    RAISE NOTICE '';

    -- Find all duplicate vehicles (same make/model/year with different VINs)
    FOR duplicate_record IN
        SELECT
            make, model, year, source_url, tenant_id,
            ARRAY_AGG(id) as vehicle_ids,
            ARRAY_AGG(vin) as vins
        FROM tracked_vehicles
        GROUP BY make, model, year, source_url, tenant_id
        HAVING COUNT(*) > 1
    LOOP
        -- For each duplicate group, find the real VIN and pseudo VIN
        real_vin_id := NULL;
        pseudo_vin_id := NULL;

        -- Loop through the VINs to identify which is real and which is pseudo
        FOR i IN 1..array_length(duplicate_record.vins, 1) LOOP
            IF duplicate_record.vins[i] LIKE 'PSEUDO_%' THEN
                pseudo_vin_id := duplicate_record.vehicle_ids[i];
            ELSE
                real_vin_id := duplicate_record.vehicle_ids[i];
            END IF;
        END LOOP;

        -- If we have both a real and pseudo VIN, delete the pseudo one
        IF real_vin_id IS NOT NULL AND pseudo_vin_id IS NOT NULL THEN
            RAISE NOTICE 'Deleting pseudo-VIN duplicate: % % % (VINs: %)',
                duplicate_record.make,
                duplicate_record.model,
                duplicate_record.year,
                array_to_string(duplicate_record.vins, ', ');

            DELETE FROM tracked_vehicles WHERE id = pseudo_vin_id;
            deleted_count := deleted_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Deleted % pseudo-VIN duplicates', deleted_count;
END $$;

-- Verify cleanup
DO $$
DECLARE
    remaining_duplicates INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification ===';

    -- Count remaining duplicates by make/model/year
    SELECT COUNT(*) INTO remaining_duplicates
    FROM (
        SELECT make, model, year, source_url, tenant_id
        FROM tracked_vehicles
        GROUP BY make, model, year, source_url, tenant_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF remaining_duplicates = 0 THEN
        RAISE NOTICE '✅ No remaining duplicates found';
    ELSE
        RAISE WARNING '⚠ Still have % groups with duplicates', remaining_duplicates;
    END IF;
END $$;
