-- Migration to fix duplicate inventory items caused by scraper running before migration
-- 20251231000005_fix_duplicate_inventory.sql

DO $$
DECLARE
    r RECORD;
    keep_id UUID;
    del_ids UUID[];
BEGIN
    -- Loop through duplicates (Same VIN, Same Source)
    FOR r IN 
        SELECT source_id, vin, array_agg(id ORDER BY first_seen_at ASC) as ids
        FROM tracked_vehicles
        WHERE source_id IS NOT NULL
        GROUP BY source_id, vin
        HAVING count(*) > 1
    LOOP
        -- Logic: Keep the OLDEST record (to preserve history)
        -- But update its 'last_seen_at' to the newest seen date from the duplicates
        keep_id := r.ids[1];
        del_ids := r.ids[2:array_length(r.ids, 1)];

        -- Update the keeper with the max last_seen_at of the group
        UPDATE tracked_vehicles
        SET last_seen_at = (
            SELECT MAX(last_seen_at) 
            FROM tracked_vehicles 
            WHERE id = ANY(r.ids)
        )
        WHERE id = keep_id;

        -- Delete the duplicates
        -- Note: If you added overrides to the NEW rows (unlikely in this short window), they will be lost.
        -- Assuming preserving history ID is more important.
        DELETE FROM tracked_vehicles 
        WHERE id = ANY(del_ids);
        
        RAISE NOTICE 'Deduplicated VIN %: Kept %, Deleted %', r.vin, keep_id, del_ids;
    END LOOP;
END $$;
