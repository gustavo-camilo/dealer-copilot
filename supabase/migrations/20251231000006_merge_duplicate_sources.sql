-- Migration to merge duplicate sources (e.g. .com vs .us)
-- 20251231000006_merge_duplicate_sources.sql

DO $$
DECLARE
    source_keep UUID;
    source_drop UUID;
BEGIN
    -- 1. Handle RPM Motors (.us is active scraper target, .com is legacy/tenant)
    SELECT id INTO source_keep FROM source_registry WHERE source_url LIKE '%rpm-motors.us%';
    SELECT id INTO source_drop FROM source_registry WHERE source_url LIKE '%rpm-motors.com%';

    IF source_keep IS NOT NULL AND source_drop IS NOT NULL THEN
        RAISE NOTICE 'Merging Source % (drop) into % (keep)', source_drop, source_keep;

        -- A. Move Vehicles
        -- Update vehicles attached to dropped source to point to kept source
        UPDATE tracked_vehicles 
        SET source_id = source_keep 
        WHERE source_id = source_drop;

        -- B. Move Snapshots
        UPDATE inventory_snapshots_unified 
        SET source_id = source_keep 
        WHERE source_id = source_drop;

        -- C. Update Tenant Sources
        -- If tenant already linked to keep, just delete the link to drop.
        -- If not linked to keep, update link to drop -> keep.
        
        -- Delete link to drop IF link to keep already exists
        DELETE FROM tenant_sources 
        WHERE source_id = source_drop 
        AND tenant_id IN (SELECT tenant_id FROM tenant_sources WHERE source_id = source_keep);

        -- Update remaining links (drop -> keep)
        UPDATE tenant_sources 
        SET source_id = source_keep 
        WHERE source_id = source_drop;

        -- D. Delete Dropped Source
        DELETE FROM source_registry WHERE id = source_drop;
    END IF;

    -- 2. Run Deduplication Logic (Duplicate VINs in same source)
    -- Copied from ...05 migration to ensure cleanup happens immediately after merge
    DECLARE
        r RECORD;
        keep_id UUID;
        del_ids UUID[];
    BEGIN
        FOR r IN 
            SELECT source_id, vin, array_agg(id ORDER BY first_seen_at ASC) as ids
            FROM tracked_vehicles
            WHERE source_id IS NOT NULL
            GROUP BY source_id, vin
            HAVING count(*) > 1
        LOOP
            keep_id := r.ids[1];
            del_ids := r.ids[2:array_length(r.ids, 1)];

            UPDATE tracked_vehicles
            SET last_seen_at = (SELECT MAX(last_seen_at) FROM tracked_vehicles WHERE id = ANY(r.ids))
            WHERE id = keep_id;

            DELETE FROM tracked_vehicles WHERE id = ANY(del_ids);
        END LOOP;
    END;

END $$;
