-- Add dark_mode_enabled column to tenants table
ALTER TABLE tenants
ADD COLUMN dark_mode_enabled BOOLEAN DEFAULT NULL;

-- NULL = not set (follow OS preference)
-- TRUE = dark mode enabled
-- FALSE = light mode enabled

COMMENT ON COLUMN tenants.dark_mode_enabled IS
'User dark mode preference. NULL = follow OS, TRUE = dark, FALSE = light';
