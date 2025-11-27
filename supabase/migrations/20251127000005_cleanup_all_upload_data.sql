-- Cleanup All Upload-Related Data
-- This migration removes all data from tables related to vehicle uploads
-- Run this to start fresh with the new noVIN_ format implementation

DO $$
BEGIN
    RAISE NOTICE '🧹 Starting cleanup of all upload-related data...';

    -- 1. Delete all tracked vehicles
    DELETE FROM tracked_vehicles;
    RAISE NOTICE '✅ Deleted all tracked_vehicles';

    -- 2. Delete all manual scraping upload records
    DELETE FROM manual_scraping_uploads;
    RAISE NOTICE '✅ Deleted all manual_scraping_uploads';

    -- 3. Delete all source registry entries (optional - uncomment if you want to remove sources too)
    -- DELETE FROM source_registry;
    -- RAISE NOTICE '✅ Deleted all source_registry entries';

    -- 4. Reset any related sequences (if needed)
    -- This ensures IDs start from 1 again
    -- ALTER SEQUENCE IF EXISTS tracked_vehicles_id_seq RESTART WITH 1;
    -- ALTER SEQUENCE IF EXISTS manual_scraping_uploads_id_seq RESTART WITH 1;

    RAISE NOTICE '🎉 Cleanup completed successfully!';
    RAISE NOTICE '📊 You can now upload files to test with the new noVIN_ format';
END $$;
