-- Add queue management fields to source_registry
ALTER TABLE source_registry 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

-- Migrate existing queue data
DO $$
DECLARE
    rec RECORD;
    source_rec_id UUID;
BEGIN
    -- Migrate from scraping_waiting_list (Dealer/Owner queue)
    -- Check if table exists first to avoid errors if already dropped
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scraping_waiting_list') THEN
        FOR rec IN SELECT * FROM scraping_waiting_list LOOP
            -- find source by URL
            SELECT id INTO source_rec_id FROM source_registry WHERE source_url = rec.website_url OR source_url LIKE '%' || rec.website_url || '%';
            
            IF source_rec_id IS NOT NULL THEN
                UPDATE source_registry 
                SET status = rec.status, 
                    priority = rec.priority
                WHERE id = source_rec_id;
            END IF;
        END LOOP;
    END IF;

    -- Migrate from competitor_scraping_waiting_list
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'competitor_scraping_waiting_list') THEN
        FOR rec IN SELECT * FROM competitor_scraping_waiting_list LOOP
            -- find source
            SELECT id INTO source_rec_id FROM source_registry WHERE source_url = rec.website_url;
            
            IF source_rec_id IS NOT NULL THEN
                UPDATE source_registry 
                SET status = rec.status, 
                    priority = rec.priority,
                    assigned_to = rec.assigned_to
                WHERE id = source_rec_id;
            END IF;
        END LOOP;
    END IF;
END $$;
