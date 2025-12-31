-- Migration to Normalize URLs (Domain Only) and Deduplicate Inventory
-- 20251231000007_normalize_and_dedup.sql

DO $$
DECLARE
    r RECORD;
    keep_id UUID;
    del_ids UUID[];
    merged_image TEXT;
    
    -- Helper to clean URL (strip https://, www., trailing /)
    -- We'll do this inline in queries for simplicity
BEGIN
    RAISE NOTICE 'Starting URL Normalization and Deduplication...';
    
    -- 1. Normalize Source Registry first (Merge duplicates like www. vs bare)
    FOR r IN SELECT * FROM source_registry WHERE source_url ~ '^https?://|www\.|/+$' LOOP
        DECLARE
            clean_url TEXT;
            existing_id UUID;
        BEGIN
            -- Robust normalization: strip protocols, www, trailing slashes
            clean_url := LOWER(TRIM(regexp_replace(regexp_replace(r.source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')));
            
            -- If it's already the same, just trim/lower it
            IF clean_url = r.source_url THEN
                UPDATE source_registry SET source_url = clean_url WHERE id = r.id;
                CONTINUE;
            END IF;

            SELECT id INTO existing_id FROM source_registry WHERE source_url = clean_url AND id != r.id;
            
            IF existing_id IS NOT NULL THEN
                -- Merge everything into the canonical (bare) source
                DELETE FROM tenant_sources ts1 WHERE ts1.source_id = r.id
                AND EXISTS (SELECT 1 FROM tenant_sources ts2 WHERE ts2.source_id = existing_id AND ts2.tenant_id = ts1.tenant_id);
                
                UPDATE tenant_sources SET source_id = existing_id WHERE source_id = r.id;
                UPDATE tracked_vehicles SET source_id = existing_id WHERE source_id = r.id;
                UPDATE inventory_snapshots_unified SET source_id = existing_id WHERE source_id = r.id;
                
                DELETE FROM source_registry WHERE id = r.id;
                RAISE NOTICE 'Merged source: % into %', r.source_url, clean_url;
            ELSE
                UPDATE source_registry SET source_url = clean_url WHERE id = r.id;
                RAISE NOTICE 'Normalized source: % -> %', r.source_url, clean_url;
            END IF;
        END;
    END LOOP;

    -- 2. Link any orphan vehicles to their correct source_id
    UPDATE tracked_vehicles tv
    SET source_id = sr.id
    FROM source_registry sr
    WHERE sr.source_url = LOWER(TRIM(regexp_replace(regexp_replace(tv.source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')))
    AND (tv.source_id IS NULL OR tv.source_id != sr.id);

    -- 3. CRITICAL: Deduplicate Tracked Vehicles BEFORE attempting to normalize source_url
    -- This prevents the Unique Constraint violation (tenant_id, source_url, vin)
    FOR r IN 
        SELECT tenant_id, source_id, vin, array_agg(id ORDER BY last_seen_at DESC, created_at DESC) as ids
        FROM tracked_vehicles
        WHERE vin IS NOT NULL
        GROUP BY tenant_id, source_id, vin
        HAVING count(*) > 1
    LOOP
        keep_id := r.ids[1]; -- Keep newest/freshest record
        del_ids := r.ids[2:array_length(r.ids, 1)];

        -- Update keep record with oldest first_seen_at and merge image
        UPDATE tracked_vehicles
        SET 
            first_seen_at = (SELECT MIN(first_seen_at) FROM tracked_vehicles WHERE id = ANY(r.ids)),
            image_url = COALESCE(image_url, (SELECT image_url FROM tracked_vehicles WHERE id = ANY(del_ids) AND image_url IS NOT NULL LIMIT 1))
        WHERE id = keep_id;

        DELETE FROM tracked_vehicles WHERE id = ANY(del_ids);
    END LOOP;

    -- 4. Finally, safely normalize the source_url string in tracked_vehicles
    UPDATE tracked_vehicles
    SET source_url = LOWER(TRIM(regexp_replace(regexp_replace(source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')))
    WHERE source_url ~ '^https?://|www\.|/+$';

    RAISE NOTICE 'Cleanup complete.';
END $$;
