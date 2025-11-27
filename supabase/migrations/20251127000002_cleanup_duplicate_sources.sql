/*
  Fix Upload Universal CSV: Clean Duplicate Source URLs

  ## Purpose
  Removes duplicate source_registry and tracked_vehicles entries where full URLs exist alongside clean domains.
  This cleanup ensures the unified vehicle tracking system uses consistent domain-based identifiers.

  ## Changes
  1. Clean duplicate source_registry entries (keep clean domain, remove full URLs)
  2. Clean duplicate tracked_vehicles entries (keep clean domain vehicles, remove full URL vehicles)

  ## Context
  Previous versions of the upload function may have created entries with full listing URLs
  instead of clean domains in the source_url field. This migration consolidates those entries.
*/

-- Clean duplicate source_registry entries
DO $$
DECLARE
    duplicate_record RECORD;
    clean_domain TEXT;
BEGIN
    RAISE NOTICE '=== Cleaning Duplicate Source Registry Entries ===';

    -- Find all source_registry entries with full URLs (http/https)
    FOR duplicate_record IN
        SELECT id, source_url, source_type, source_name, tenant_id
        FROM source_registry
        WHERE source_url LIKE 'http%'
    LOOP
        -- Extract clean domain from the full URL
        clean_domain := regexp_replace(
            regexp_replace(duplicate_record.source_url, '^https?://(www\.)?', ''),
            '/.*$',
            ''
        );
        clean_domain := lower(clean_domain);

        RAISE NOTICE 'Processing: % -> %', duplicate_record.source_url, clean_domain;

        -- Check if clean domain entry exists
        IF EXISTS (
            SELECT 1 FROM source_registry
            WHERE source_url = clean_domain
            AND id != duplicate_record.id
        ) THEN
            -- Clean domain exists, delete the full URL entry
            RAISE NOTICE '  ✗ Deleting duplicate full URL entry: %', duplicate_record.source_url;
            DELETE FROM source_registry WHERE id = duplicate_record.id;
        ELSE
            -- Clean domain doesn't exist, update this entry to use clean domain
            RAISE NOTICE '  ✓ Updating entry to clean domain: % -> %', duplicate_record.source_url, clean_domain;
            UPDATE source_registry
            SET source_url = clean_domain
            WHERE id = duplicate_record.id;
        END IF;
    END LOOP;

    RAISE NOTICE '✅ Cleaned duplicate source registry entries';
END $$;

-- Clean duplicate tracked_vehicles entries
DO $$
DECLARE
    duplicate_record RECORD;
    clean_domain TEXT;
    keeper_id UUID;
    deleted_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Cleaning Duplicate Tracked Vehicles Entries ===';

    -- Find all tracked_vehicles with full URL source_urls
    FOR duplicate_record IN
        SELECT DISTINCT source_url, vin, tenant_id
        FROM tracked_vehicles
        WHERE source_url LIKE 'http%'
    LOOP
        -- Extract clean domain
        clean_domain := regexp_replace(
            regexp_replace(duplicate_record.source_url, '^https?://(www\.)?', ''),
            '/.*$',
            ''
        );
        clean_domain := lower(clean_domain);

        -- Check if vehicle with clean domain exists
        SELECT id INTO keeper_id
        FROM tracked_vehicles
        WHERE source_url = clean_domain
        AND vin = duplicate_record.vin
        AND (
            (tenant_id = duplicate_record.tenant_id) OR
            (tenant_id IS NULL AND duplicate_record.tenant_id IS NULL)
        )
        LIMIT 1;

        IF keeper_id IS NOT NULL THEN
            -- Clean domain version exists, delete full URL versions
            DELETE FROM tracked_vehicles
            WHERE source_url = duplicate_record.source_url
            AND vin = duplicate_record.vin
            AND (
                (tenant_id = duplicate_record.tenant_id) OR
                (tenant_id IS NULL AND duplicate_record.tenant_id IS NULL)
            );

            deleted_count := deleted_count + 1;
            RAISE NOTICE '  ✗ Deleted duplicate vehicle: VIN=%, source_url=%', duplicate_record.vin, duplicate_record.source_url;
        ELSE
            -- Clean domain doesn't exist, update this entry
            UPDATE tracked_vehicles
            SET source_url = clean_domain
            WHERE source_url = duplicate_record.source_url
            AND vin = duplicate_record.vin
            AND (
                (tenant_id = duplicate_record.tenant_id) OR
                (tenant_id IS NULL AND duplicate_record.tenant_id IS NULL)
            );

            updated_count := updated_count + 1;
            RAISE NOTICE '  ✓ Updated vehicle to clean domain: VIN=%, % -> %', duplicate_record.vin, duplicate_record.source_url, clean_domain;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Cleaned duplicate vehicle entries:';
    RAISE NOTICE '   - Deleted: % duplicate vehicles', deleted_count;
    RAISE NOTICE '   - Updated: % vehicles to use clean domains', updated_count;
END $$;

-- Verify cleanup results
DO $$
DECLARE
    bad_sources INTEGER;
    bad_vehicles INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Verification ===';

    -- Count remaining full URLs in source_registry
    SELECT COUNT(*) INTO bad_sources
    FROM source_registry
    WHERE source_url LIKE 'http%';

    -- Count remaining full URLs in tracked_vehicles
    SELECT COUNT(*) INTO bad_vehicles
    FROM tracked_vehicles
    WHERE source_url LIKE 'http%';

    IF bad_sources = 0 AND bad_vehicles = 0 THEN
        RAISE NOTICE '✅ All source URLs are now clean domains';
    ELSE
        RAISE WARNING '⚠ Still have % source_registry and % tracked_vehicles entries with full URLs', bad_sources, bad_vehicles;
    END IF;
END $$;
