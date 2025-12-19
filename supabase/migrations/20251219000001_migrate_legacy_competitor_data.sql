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
    v_competitor_url TEXT;
    v_competitor_name TEXT;
    v_source_id UUID;
    v_vehicle_count INT;
    v_avg_price DECIMAL;
    v_min_price DECIMAL;
    v_max_price DECIMAL;
    v_avg_mileage INT;
    v_min_mileage INT;
    v_max_mileage INT;
    v_total_value DECIMAL;
    v_make_dist JSONB;
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
        competitor_url INTO v_competitor_url
    FROM competitor_vehicles
    WHERE competitor_url IS NOT NULL
    LIMIT 1;

    -- If no URL found, use a placeholder
    IF v_competitor_url IS NULL THEN
        RAISE NOTICE 'No URL found in competitor_vehicles. Using placeholder.';
        v_competitor_url := 'unknown-competitor.com';
    END IF;

    -- Extract domain from URL
    v_competitor_url := regexp_replace(v_competitor_url, '^https?://(www\.)?', '');
    v_competitor_url := regexp_replace(v_competitor_url, '/.*$', '');

    RAISE NOTICE 'Detected competitor URL: %', v_competitor_url;

    -- Check if source exists in source_registry
    SELECT id, source_name INTO v_source_id, v_competitor_name
    FROM source_registry
    WHERE source_url = v_competitor_url;

    -- If not exists, create source_registry entry
    IF v_source_id IS NULL THEN
        INSERT INTO source_registry (
            source_url,
            source_type,
            source_name,
            tenant_id,
            scraping_enabled,
            last_scraped_at
        ) VALUES (
            v_competitor_url,
            'competitor',
            COALESCE(v_competitor_name, v_competitor_url),
            NULL,  -- competitor data is global
            true,
            NOW()
        ) RETURNING id INTO v_source_id;

        RAISE NOTICE 'Created source_registry entry for: %', v_competitor_url;
    ELSE
        RAISE NOTICE 'Source registry entry already exists (ID: %)', v_source_id;
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
        v_competitor_url as source_url,
        'competitor' as source_type,
        COALESCE(cv.vin, 'noVIN_' || cv.year || '_' || cv.make || '_' || cv.model || '_' || COALESCE(cv.mileage::text, cv.price::text)) as vin,
        cv.year,
        cv.make,
        cv.model,
        cv.price,
        cv.mileage,
        cv.listing_url,
        cv.image_url,
        COALESCE(cv.first_seen_at, cv.created_at, NOW()) as first_seen_at,
        COALESCE(cv.last_seen_at, cv.updated_at, NOW()) as last_seen_at,
        COALESCE(cv.status, 'active') as status
    FROM competitor_vehicles cv
    ON CONFLICT (tenant_id, source_url, vin) WHERE tenant_id IS NULL
    DO UPDATE SET
        price = EXCLUDED.price,
        mileage = EXCLUDED.mileage,
        last_seen_at = EXCLUDED.last_seen_at;

    GET DIAGNOSTICS v_vehicle_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % vehicles to tracked_vehicles', v_vehicle_count;

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
        v_vehicle_count,
        v_avg_price,
        v_min_price,
        v_max_price,
        v_avg_mileage,
        v_min_mileage,
        v_max_mileage,
        v_total_value
    FROM tracked_vehicles
    WHERE source_url = v_competitor_url
      AND source_type = 'competitor'
      AND status = 'active';

    -- Calculate make distribution
    SELECT jsonb_object_agg(make, make_count)
    INTO v_make_dist
    FROM (
        SELECT make, COUNT(*)::INT as make_count
        FROM tracked_vehicles
        WHERE source_url = v_competitor_url
          AND source_type = 'competitor'
          AND status = 'active'
        GROUP BY make
        ORDER BY make_count DESC
        LIMIT 10
    ) subq;

    RAISE NOTICE 'Calculated stats: % vehicles, avg price: %, avg mileage: %',
                 v_vehicle_count, v_avg_price, v_avg_mileage;

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
        v_competitor_url,
        'competitor',
        COALESCE(v_competitor_name, v_competitor_url),
        NULL,
        CURRENT_DATE,
        NOW(),
        v_vehicle_count,
        v_avg_price,
        v_min_price,
        v_max_price,
        v_avg_mileage,
        v_min_mileage,
        v_max_mileage,
        v_total_value,
        v_make_dist,
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

    RAISE NOTICE 'Created/updated snapshot for % with % vehicles', v_competitor_url, v_vehicle_count;

    -- Update source_registry last_scraped_at
    UPDATE source_registry
    SET last_scraped_at = NOW()
    WHERE id = v_source_id;

    RAISE NOTICE '=== Migration Completed Successfully ===';
    RAISE NOTICE 'Competitor: %', v_competitor_url;
    RAISE NOTICE 'Vehicles migrated: %', v_vehicle_count;
    RAISE NOTICE 'Snapshot created: Yes';
    RAISE NOTICE 'Source registry updated: Yes';

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Migration failed: %', SQLERRM;
    RAISE;
END $$;
