# Super Admin Setup Guide

## How to Create a Super Admin User

There is no default super admin account in the system for security reasons. You must create one manually after your first user signup.

### Step 1: Sign Up Through the App

1. Navigate to your deployed app or localhost
2. Click "Start Free Trial" or go to `/signup`
3. Fill out the signup form with:
   - Your dealership information
   - Your email and password
   - Complete the multi-step form

4. You'll be automatically logged in as a regular `tenant_admin` user

### Step 2: Elevate to Super Admin

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Run this SQL command (replace with your email):

```sql
UPDATE users
SET role = 'super_admin'
WHERE email = 'your-email@example.com';
```

### Step 3: Access the Admin Panel

1. **Sign out** from the app
2. **Sign back in** with your credentials
3. Navigate to `/admin` or add a link in your navigation

The super admin panel will now be accessible and you can:
- View all tenants (dealerships)
- See user statistics
- Monitor subscription status
- View tenant details and activity

## Super Admin Capabilities

As a super admin, you have access to:

- **Admin Panel** (`/admin`): Full platform oversight
- **All Tenant Data**: View (but respect) tenant isolation
- **User Management**: See all users across all tenants
- **Subscription Management**: Monitor billing status
- **System Analytics**: Platform-wide metrics

## Security Notes

- ⚠️ Super admins have elevated privileges - protect these accounts
- The super admin role bypasses some RLS policies to view aggregate data
- Do not share super admin credentials
- Consider using a separate email for super admin access
- Implement 2FA for super admin accounts in production

## Multiple Super Admins

To create additional super admin users:

```sql
UPDATE users
SET role = 'super_admin'
WHERE email IN ('admin1@example.com', 'admin2@example.com');
```

## Reverting to Regular Admin

If you need to remove super admin privileges:

```sql
UPDATE users
SET role = 'tenant_admin'
WHERE email = 'user@example.com';
```

## Checking Current Role

To verify a user's role:

```sql
SELECT email, role, tenant_id
FROM users
WHERE email = 'your-email@example.com';
```

## Troubleshooting

**Issue**: Can't access `/admin` after setting role
- **Solution**: Sign out completely and sign back in. The auth context needs to refresh.

**Issue**: Still seeing "Access Denied" on admin panel
- **Solution**: Verify the SQL command completed successfully. Check the role in Supabase table viewer.

**Issue**: Admin panel shows no data
- **Solution**: Ensure RLS policies are active and the super_admin role has appropriate select permissions.

## Production Recommendations

For production environments:

1. **Create Super Admin First**: Before inviting real tenants
2. **Use Strong Passwords**: Require complex passwords for super admins
3. **Enable Audit Logging**: Track all super admin actions
4. **Separate Accounts**: Don't use personal email for super admin
5. **Limited Access**: Only 2-3 people should have super admin
6. **Regular Reviews**: Audit super admin accounts quarterly

## Deleting a Super Admin

To completely remove a super admin account:

```sql
-- First, change role to prevent access
UPDATE users SET role = 'tenant_user' WHERE email = 'old-admin@example.com';

-- Or delete the user entirely (cascade will handle related records)
DELETE FROM users WHERE email = 'old-admin@example.com';
```

Note: Deleting from the `users` table will also require deleting from Supabase Auth:

```sql
-- In Supabase Auth (use dashboard or Auth API)
DELETE FROM auth.users WHERE email = 'old-admin@example.com';
```
