-- Migration file: 20251126000005_consolidate_scraping_queues.sql

-- 1. Enhance source_registry table with workflow fields
ALTER TABLE source_registry 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'active', 'failed', 'rejected', 'completed')),
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes TEXT;


-- 2. Migrate Dealer Waiting List (scraping_waiting_list) - only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scraping_waiting_list') THEN
    INSERT INTO source_registry (
      source_url,
      source_type,
      source_name,
      tenant_id,
      status,
      assigned_to,
      priority,
      notes,
      created_at,
      updated_at
    )
    SELECT 
      t.website_url,
      'dealer',
      t.name,
      swl.tenant_id,
      CASE 
        WHEN swl.status = 'completed' THEN 'active'
        ELSE swl.status 
      END,
      swl.assigned_to,
      swl.priority,
      swl.notes,
      swl.requested_at,
      swl.requested_at
    FROM scraping_waiting_list swl
    JOIN tenants t ON swl.tenant_id = t.id
    WHERE t.website_url IS NOT NULL
    ON CONFLICT (source_url) DO UPDATE SET
      status = EXCLUDED.status,
      assigned_to = EXCLUDED.assigned_to,
      priority = EXCLUDED.priority,
      notes = EXCLUDED.notes;
  END IF;
END $$;

-- 3. Migrate Competitor Queue (competitor_scraping_waiting_list) - only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competitor_scraping_waiting_list') THEN
    INSERT INTO source_registry (
      source_url,
      source_type,
      source_name,
      tenant_id,
      status,
      assigned_to,
      priority,
      notes,
      created_at,
      updated_at
    )
    SELECT 
      cswl.competitor_url,
      'competitor',
      cswl.competitor_name,
      NULL,
      CASE 
        WHEN cswl.status = 'completed' THEN 'active'
        ELSE cswl.status 
      END,
      cswl.assigned_to,
      cswl.priority,
      cswl.notes,
      cswl.requested_at,
      cswl.requested_at
    FROM competitor_scraping_waiting_list cswl
    ON CONFLICT (source_url) DO UPDATE SET
      status = EXCLUDED.status,
      assigned_to = EXCLUDED.assigned_to,
      priority = EXCLUDED.priority,
      notes = EXCLUDED.notes;
  END IF;
END $$;

-- 4. Create View for Admin Dashboard
CREATE OR REPLACE VIEW scraping_queue_view AS
SELECT 
  sr.id,
  sr.source_url,
  sr.source_type,
  sr.source_name,
  sr.tenant_id,
  t.name as tenant_name,
  sr.status,
  sr.priority,
  sr.notes,
  sr.assigned_to,
  au.email as assigned_user_email,
  au.raw_user_meta_data->>'full_name' as assigned_user_name,
  sr.created_at as requested_at,
  sr.updated_at,
  sr.last_scraped_at,
  sr.next_scheduled_scrape
FROM source_registry sr
LEFT JOIN tenants t ON sr.tenant_id = t.id
LEFT JOIN auth.users au ON sr.assigned_to = au.id;

-- 5. Rename old tables to deprecated
ALTER TABLE IF EXISTS scraping_waiting_list RENAME TO scraping_waiting_list_deprecated;
ALTER TABLE IF EXISTS competitor_scraping_waiting_list RENAME TO competitor_scraping_waiting_list_deprecated;
