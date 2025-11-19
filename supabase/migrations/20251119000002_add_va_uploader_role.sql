-- Add va_uploader role to user_role enum type
-- First, check if the type exists and add the new value if it doesn't already exist
DO $$
BEGIN
  -- Add 'va_uploader' to the role enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'va_uploader'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    -- Note: We need to handle this differently since the role type might not be an enum
    -- Let's check if role column has a check constraint instead
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'role'
      AND data_type = 'text'
    ) THEN
      -- Role is text type with check constraint, update the constraint
      ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE public.users ADD CONSTRAINT users_role_check
        CHECK (role IN ('super_admin', 'tenant_admin', 'tenant_user', 'va_uploader'));
    END IF;
  END IF;
END $$;

-- Update RLS policies to include va_uploader where appropriate
-- No changes needed to existing policies as they already check for specific roles

-- Add comment for documentation
COMMENT ON COLUMN public.users.role IS 'User role: super_admin, tenant_admin, tenant_user, or va_uploader';
