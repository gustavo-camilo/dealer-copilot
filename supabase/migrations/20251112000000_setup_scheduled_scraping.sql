-- =====================================================
-- DEALER CO-PILOT: SCHEDULED WEBSITE SCRAPING
-- =====================================================
-- This migration sets up daily automated scraping for all dealer websites
-- Scraping runs at 2 AM daily to avoid peak hours and reduce server load

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- =====================================================
-- SCHEDULED JOB: Daily Website Scraping
-- =====================================================
-- Runs every day at 2 AM (adjust timezone as needed)
-- Scrapes all active/trial tenants with website URLs

SELECT cron.schedule(
  'daily-dealer-inventory-scraping',    -- Job name
  '0 2 * * *',                          -- Cron expression: Daily at 2:00 AM
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/scrape-dealer-inventory',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000  -- 5 minute timeout
  );
  $$
);

-- =====================================================
-- CONFIGURATION SETTINGS
-- =====================================================
-- Store configuration in database settings
-- Replace these values with your actual Supabase credentials

-- IMPORTANT: You must set these after running this migration
-- Example:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ueoovsjhaxykewtsnbqx.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- View scheduled cron jobs
-- SELECT * FROM cron.job WHERE jobname = 'daily-dealer-inventory-scraping';

-- View cron job execution history
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-dealer-inventory-scraping')
-- ORDER BY start_time DESC
-- LIMIT 20;

-- =====================================================
-- MANAGEMENT QUERIES
-- =====================================================

-- Disable scheduled scraping (without deleting)
-- UPDATE cron.job SET active = false WHERE jobname = 'daily-dealer-inventory-scraping';

-- Re-enable scheduled scraping
-- UPDATE cron.job SET active = true WHERE jobname = 'daily-dealer-inventory-scraping';

-- Delete scheduled scraping completely
-- SELECT cron.unschedule('daily-dealer-inventory-scraping');

-- Change schedule (e.g., run every 6 hours instead)
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-dealer-inventory-scraping'),
--   schedule := '0 */6 * * *'  -- Every 6 hours
-- );

-- =====================================================
-- COST OPTIMIZATION NOTES
-- =====================================================
--
-- Daily Scraping (2 AM):
-- - Runs during low-traffic hours
-- - Reduces server load during business hours
-- - Free tier includes 500K function invocations/month
-- - Estimated usage: ~30 invocations/month (1 per day)
-- - Cost: $0 (well within free tier)
--
-- On-Demand Scraping (Manual):
-- - Triggered by user via onboarding page
-- - Only scrapes the requesting tenant's website
-- - Uses full resources for immediate results
-- - Cost: Negligible (included in free tier)
--
-- Best Practices:
-- 1. Don't scrape more than once per day per tenant (avoid hammering websites)
-- 2. Respect robots.txt and rate limits
-- 3. Use proper User-Agent headers
-- 4. Monitor scraping_logs table for failures
-- 5. Set up alerts for repeated failures

-- =====================================================
-- ALTERNATIVE SCHEDULES
-- =====================================================
--
-- Twice daily (morning and evening):
-- '0 2,14 * * *'  -- 2 AM and 2 PM
--
-- Every 6 hours:
-- '0 */6 * * *'
--
-- Weekdays only at 2 AM:
-- '0 2 * * 1-5'
--
-- Weekly on Sunday at midnight:
-- '0 0 * * 0'
--

COMMENT ON EXTENSION pg_cron IS 'Automated scheduling for daily website scraping';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Scheduled scraping setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You must configure the database settings:';
  RAISE NOTICE '1. ALTER DATABASE postgres SET app.settings.supabase_url = ''https://your-project.supabase.co'';';
  RAISE NOTICE '2. ALTER DATABASE postgres SET app.settings.service_role_key = ''your-service-role-key'';';
  RAISE NOTICE '';
  RAISE NOTICE '📊 To verify the cron job:';
  RAISE NOTICE 'SELECT * FROM cron.job WHERE jobname = ''daily-dealer-inventory-scraping'';';
END $$;
