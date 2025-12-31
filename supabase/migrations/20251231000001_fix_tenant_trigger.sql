-- Migration to drop broken legacy trigger on tenants table
-- This trigger was trying to update the 'scraping_waiting_list' table which has been renamed/deprecated

-- 1. Drop the trigger on the tenants table
DROP TRIGGER IF EXISTS on_inventory_status_change ON tenants;

-- 2. Drop the function
DROP FUNCTION IF EXISTS remove_from_waiting_list_when_ready() CASCADE;
