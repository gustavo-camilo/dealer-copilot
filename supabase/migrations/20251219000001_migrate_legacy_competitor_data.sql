-- ============================================================
-- Migration: 20251219000001_migrate_legacy_competitor_data.sql
-- ============================================================
--
-- PURPOSE: Migrate competitor data from legacy tables to unified architecture
--
-- This migration:
-- 1. Copies vehicles from competitor_vehicles → tracked_vehicles
-- 2. Creates snapshot in inventory_snapshots_unified
-- 3. Updates source_registry with last_scraped_at
--
-- ============================================================

DO $$
DECLARE
    competitor_url TEXT;
    competitor_name TEXT;
    source_id UUID;
    vehicle_count INT;
    avg_price DECIMAL;
    min_price DECIMAL;
    max_price DECIMAL;
    avg_mileage INT;
    min_mileage INT;
    max_mileage INT;
    total_value DECIMAL;
    make_dist JSONB;
BEGIN
    RAISE NOTICE '=== Starting Legacy Competitor Data Migration ===';

    -- Check if competitor_vehicles table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'competitor_vehicles') THEN
        RAISE NOTICE 'competitor_vehicles table does not exist. Nothing to migrate.';
        RETURN;
    END IF;

    -- Find the competitor URL from competitor_vehicles
    -- Assuming all rows are for the same competitor
    SELECT DISTINCT
        COALESCE(url, listing_url) INTO competitor_url
    FROM competitor_vehicles
    WHERE url IS NOT NULL OR listing_url IS NOT NULL
    LIMIT 1;

    -- If no URL found, use a placeholder
    IF competitor_url IS NULL THEN
        RAISE NOTICE 'No URL found in competitor_vehicles. Using placeholder.';
        competitor_url := 'unknown-competitor.com';
    END IF;

    -- Extract domain from URL
    competitor_url := regexp_replace(competitor_url, '^https?://(www\.)?', '');
    competitor_url := regexp_replace(competitor_url, '/.*$', '');

    RAISE NOTICE 'Detected competitor URL: %', competitor_url;

    -- Check if source exists in source_registry
    SELECT id, source_name INTO source_id, competitor_name
    FROM source_registry
    WHERE source_url = competitor_url;

    -- If not exists, create source_registry entry
    IF source_id IS NULL THEN
        INSERT INTO source_registry (
            source_url,
            source_type,
            source_name,
            tenant_id,
            scraping_enabled,
            last_scraped_at
        ) VALUES (
            competitor_url,
            'competitor',
            COALESCE(competitor_name, competitor_url),
            NULL,  -- competitor data is global
            true,
            NOW()
        ) RETURNING id INTO source_id;

        RAISE NOTICE 'Created source_registry entry for: %', competitor_url;
    ELSE
        RAISE NOTICE 'Source registry entry already exists (ID: %)', source_id;
    END IF;

    -- Migrate vehicles from competitor_vehicles to tracked_vehicles
    INSERT INTO tracked_vehicles (
        tenant_id,
        source_url,
        source_type,
        vin,
        year,
        make,
        model,
        price,
        mileage,
        listing_url,
        image_url,
        first_seen_at,
        last_seen_at,
        status
    )
    SELECT
        NULL as tenant_id,  -- competitor vehicles are global
        competitor_url as source_url,
        'competitor' as source_type,
        COALESCE(vin, 'noVIN_' || year || '_' || make || '_' || model || '_' || COALESCE(mileage::text, price::text)) as vin,
        year,
        make,
        model,
        price,
        mileage,
        COALESCE(listing_url, url) as listing_url,
        image_url,
        COALESCE(first_seen_at, created_at, NOW()) as first_seen_at,
        COALESCE(last_seen_at, updated_at, NOW()) as last_seen_at,
        COALESCE(status, 'active') as status
    FROM competitor_vehicles
    ON CONFLICT (tenant_id, source_url, vin) WHERE tenant_id IS NULL
    DO UPDATE SET
        price = EXCLUDED.price,
        mileage = EXCLUDED.mileage,
        last_seen_at = EXCLUDED.last_seen_at;

    GET DIAGNOSTICS vehicle_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % vehicles to tracked_vehicles', vehicle_count;

    -- Calculate aggregate statistics
    SELECT
        COUNT(*),
        AVG(price)::DECIMAL,
        MIN(price)::DECIMAL,
        MAX(price)::DECIMAL,
        AVG(mileage)::INT,
        MIN(mileage)::INT,
        MAX(mileage)::INT,
        SUM(price)::DECIMAL
    INTO
        vehicle_count,
        avg_price,
        min_price,
        max_price,
        avg_mileage,
        min_mileage,
        max_mileage,
        total_value
    FROM tracked_vehicles
    WHERE source_url = competitor_url
      AND source_type = 'competitor'
      AND status = 'active';

    -- Calculate make distribution
    SELECT jsonb_object_agg(make, make_count)
    INTO make_dist
    FROM (
        SELECT make, COUNT(*)::INT as make_count
        FROM tracked_vehicles
        WHERE source_url = competitor_url
          AND source_type = 'competitor'
          AND status = 'active'
        GROUP BY make
        ORDER BY make_count DESC
        LIMIT 10
    ) subq;

    RAISE NOTICE 'Calculated stats: % vehicles, avg price: %, avg mileage: %',
                 vehicle_count, avg_price, avg_mileage;

    -- Create snapshot in inventory_snapshots_unified
    INSERT INTO inventory_snapshots_unified (
        source_url,
        source_type,
        source_name,
        tenant_id,
        snapshot_date,
        scanned_at,
        vehicle_count,
        avg_price,
        min_price,
        max_price,
        avg_mileage,
        min_mileage,
        max_mileage,
        total_inventory_value,
        make_distribution,
        status
    ) VALUES (
        competitor_url,
        'competitor',
        COALESCE(competitor_name, competitor_url),
        NULL,
        CURRENT_DATE,
        NOW(),
        vehicle_count,
        avg_price,
        min_price,
        max_price,
        avg_mileage,
        min_mileage,
        max_mileage,
        total_value,
        make_dist,
        'success'
    )
    ON CONFLICT (source_url, snapshot_date) WHERE tenant_id IS NULL
    DO UPDATE SET
        vehicle_count = EXCLUDED.vehicle_count,
        avg_price = EXCLUDED.avg_price,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        avg_mileage = EXCLUDED.avg_mileage,
        min_mileage = EXCLUDED.min_mileage,
        max_mileage = EXCLUDED.max_mileage,
        total_inventory_value = EXCLUDED.total_inventory_value,
        make_distribution = EXCLUDED.make_distribution,
        scanned_at = EXCLUDED.scanned_at,
        status = EXCLUDED.status;

    RAISE NOTICE 'Created/updated snapshot for % with % vehicles', competitor_url, vehicle_count;

    -- Update source_registry last_scraped_at
    UPDATE source_registry
    SET last_scraped_at = NOW()
    WHERE id = source_id;

    RAISE NOTICE '=== Migration Completed Successfully ===';
    RAISE NOTICE 'Competitor: %', competitor_url;
    RAISE NOTICE 'Vehicles migrated: %', vehicle_count;
    RAISE NOTICE 'Snapshot created: Yes';
    RAISE NOTICE 'Source registry updated: Yes';

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Migration failed: %', SQLERRM;
    RAISE;
END $$;
