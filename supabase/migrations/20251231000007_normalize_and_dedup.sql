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

    -- 1. Normalize Source Registry (Strip Protocol & WWW)
    -- We want 'https://www.rpm-motors.us/' -> 'rpm-motors.us'
    -- Note: We loop to handle potential conflicts (if both 'rpm-motors.us' and 'www.rpm-motors.us' exist)
    FOR r IN SELECT * FROM source_registry WHERE source_url ~ '^https?://|www\.' LOOP
        DECLARE
            clean_url TEXT;
            existing_id UUID;
        BEGIN
            clean_url := regexp_replace(regexp_replace(r.source_url, '^https?://(www\.)?', '', 'i'), '/+$', '');
            
            -- Check if clean version already exists (different ID)
            SELECT id INTO existing_id FROM source_registry WHERE source_url = clean_url AND id != r.id;
            
            IF existing_id IS NOT NULL THEN
                -- MERGE: Handle tenant_sources links (avoid unique constraint violation)
                -- 1. Delete links to 'r.id' where a link to 'existing_id' already exists for same tenant
                DELETE FROM tenant_sources ts1
                WHERE ts1.source_id = r.id
                AND EXISTS (
                    SELECT 1 FROM tenant_sources ts2 
                    WHERE ts2.source_id = existing_id 
                    AND ts2.tenant_id = ts1.tenant_id
                );
                
                -- 2. Update remaining links
                UPDATE tenant_sources SET source_id = existing_id WHERE source_id = r.id;
                
                -- Move vehicles and snapshots
                UPDATE tracked_vehicles SET source_id = existing_id WHERE source_id = r.id;
                UPDATE inventory_snapshots_unified SET source_id = existing_id WHERE source_id = r.id;
                
                -- Delete the redundant source
                DELETE FROM source_registry WHERE id = r.id;
                RAISE NOTICE 'Merged Source % (%) into % (%)', r.source_url, r.id, clean_url, existing_id;
            ELSE
                -- UPDATE: just clean the string
                UPDATE source_registry SET source_url = clean_url WHERE id = r.id;
                RAISE NOTICE 'Normalized Source: % -> %', r.source_url, clean_url;
            END IF;
        END;
    END LOOP;

    -- 2. Normalize Tracked Vehicles (for historical matching)
    UPDATE tracked_vehicles
    SET source_url = regexp_replace(regexp_replace(source_url, '^https?://(www\.)?', '', 'i'), '/+$', '')
    WHERE source_url ~ '^https?://|www\.';

    -- 3. Link Orphans
    -- Now that everything is normalized, simple matching works
    UPDATE tracked_vehicles tv
    SET source_id = sr.id
    FROM source_registry sr
    WHERE tv.source_id IS NULL 
    AND tv.source_url = sr.source_url;

    RAISE NOTICE 'Orphans Linked. Starting Deduplication...';

    -- 4. Intelligent Deduplication (Same Logic as before)
    FOR r IN 
        SELECT source_id, vin, array_agg(id ORDER BY first_seen_at ASC) as ids
        FROM tracked_vehicles
        WHERE source_id IS NOT NULL
        GROUP BY source_id, vin
        HAVING count(*) > 1
    LOOP
        keep_id := r.ids[1]; -- Oldest
        del_ids := r.ids[2:array_length(r.ids, 1)];

        -- Grab image from duplicates if main is missing
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
        
        RAISE NOTICE 'Deduplicated VIN %', r.vin;
    END LOOP;

END $$;
