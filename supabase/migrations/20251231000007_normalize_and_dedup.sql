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
    RAISE NOTICE 'Starting Normalization...';

    -- 1. Normalize Source Registry (Slightly improved to be more robust)
    FOR r IN SELECT * FROM source_registry WHERE source_url ~ '^https?://|www\.' LOOP
        DECLARE
            clean_url TEXT;
            existing_id UUID;
        BEGIN
            clean_url := regexp_replace(regexp_replace(r.source_url, '^https?://(www\.)?', '', 'i'), '/+$', '');
            
            SELECT id INTO existing_id FROM source_registry WHERE source_url = clean_url AND id != r.id;
            
            IF existing_id IS NOT NULL THEN
                DELETE FROM tenant_sources ts1
                WHERE ts1.source_id = r.id
                AND EXISTS (
                    SELECT 1 FROM tenant_sources ts2 
                    WHERE ts2.source_id = existing_id 
                    AND ts2.tenant_id = ts1.tenant_id
                );
                
                UPDATE tenant_sources SET source_id = existing_id WHERE source_id = r.id;
                UPDATE tracked_vehicles SET source_id = existing_id WHERE source_id = r.id;
                UPDATE inventory_snapshots_unified SET source_id = existing_id WHERE source_id = r.id;
                
                DELETE FROM source_registry WHERE id = r.id;
                RAISE NOTICE 'Merged Source % into %', r.source_url, clean_url;
            ELSE
                UPDATE source_registry SET source_url = clean_url WHERE id = r.id;
            END IF;
        END;
    END LOOP;

    -- 2. Link ALL vehicles to their canonical source_id using logic that matches the new standard
    -- We do this BEFORE normalizing source_url to identify duplicates
    UPDATE tracked_vehicles tv
    SET source_id = sr.id
    FROM source_registry sr
    WHERE sr.source_url = regexp_replace(regexp_replace(tv.source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')
    AND (tv.source_id IS NULL OR tv.source_id != sr.id);

    RAISE NOTICE 'Links synchronized. Starting Deduplication...';

    -- 3. Intelligent Deduplication (Group by source_id and vin)
    -- This removes records that WOULD conflict when we normalize source_url
    FOR r IN 
        SELECT source_id, vin, array_agg(id ORDER BY first_seen_at ASC) as ids
        FROM tracked_vehicles
        WHERE source_id IS NOT NULL
        GROUP BY source_id, vin
        HAVING count(*) > 1
    LOOP
        keep_id := r.ids[1];
        del_ids := r.ids[2:array_length(r.ids, 1)];

        SELECT image_url INTO merged_image 
        FROM tracked_vehicles 
        WHERE id = ANY(del_ids) 
        AND image_url IS NOT NULL 
        LIMIT 1;

        UPDATE tracked_vehicles
        SET 
            last_seen_at = (SELECT MAX(last_seen_at) FROM tracked_vehicles WHERE id = ANY(r.ids)),
            image_url = COALESCE(image_url, merged_image)
        WHERE id = keep_id;

        DELETE FROM tracked_vehicles WHERE id = ANY(del_ids);
        RAISE NOTICE 'Deduplicated VIN % for source %', r.vin, r.source_id;
    END LOOP;

    -- 4. NOW it is safe to normalize source_url in tracked_vehicles
    -- because duplicates that would have caused a unique constraint violation are gone
    UPDATE tracked_vehicles
    SET source_url = regexp_replace(regexp_replace(source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')
    WHERE source_url ~ '^https?://|www\.';

    RAISE NOTICE 'Normalization and Deduplication complete.';
END $$;
