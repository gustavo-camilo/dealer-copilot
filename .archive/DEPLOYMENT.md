# Deployment Guide

## Overview
This guide covers deploying the Dealer Copilot application to production.

## Prerequisites
- Node.js 18+ installed
- Supabase project set up
- Git repository

## Build Configuration

### Package.json Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production (creates `dist` folder)
- `npm start` - Serve production build (uses `serve` package)

### Static File Server
The app uses `serve` to serve the production build with proper SPA routing support.

## Environment Variables ⚠️ CRITICAL

**THE BLANK PAGE ERROR IS CAUSED BY MISSING ENVIRONMENT VARIABLES**

You need to set these environment variables in your deployment platform **BEFORE** building:

### Required Variables
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### How to Get These Values

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **Project API keys** → **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`

### Important Notes
- ⚠️ **MUST be prefixed with `VITE_`** - This is required by Vite
- ⚠️ **Set BEFORE building** - Variables are embedded at build time, not runtime
- ⚠️ **Rebuild after changes** - Changing env vars requires a new build
- The anon key is safe to expose in frontend code (it's public by design)

## Database Setup

### 1. Apply Migrations
Before deploying, ensure all database migrations are applied:

```bash
# Push migrations to Supabase
npx supabase db push
```

### 2. Critical Migration
The latest migration fixes RLS policies that were preventing tenant creation:
- File: `supabase/migrations/20251111185304_restore_tenant_rls_policies.sql`
- This MUST be applied for signup to work

## Deployment Instructions

### ⚠️ BEFORE YOU DEPLOY - Set Environment Variables First!

**Your deployment will show a blank page if you don't set environment variables BEFORE building.**

Go to your deployment platform and add these environment variables:
1. `VITE_SUPABASE_URL` - Your Supabase project URL
2. `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

Then trigger a rebuild. The variables will be embedded into the JavaScript bundle.

### General Platform (Render, Railway, Heroku, etc.)

#### 1. Set Environment Variables FIRST
In your platform's dashboard, add:
- `VITE_SUPABASE_URL` = `https://xxxxxxxxxxxxx.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGc...` (your anon key)

#### 2. Build Command
```bash
npm install && npm run build
```

#### 3. Start Command
```bash
npm start
```

#### 4. Port Configuration
The start command automatically uses the `PORT` environment variable set by the platform.

#### 5. Trigger Deploy
After setting variables, trigger a new deployment/build.

### Platform-Specific Notes

#### Render
- **Type**: Web Service
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Add variables in Settings → Environment

#### Vercel
Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

#### Railway
- Automatically detects Node.js
- Set build command: `npm run build`
- Set start command: `npm start`
- Add environment variables in Settings

#### Netlify
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Troubleshooting

### White Page / Blank Screen
**Cause**: Missing static file server or incorrect routing configuration
**Solution**: Ensure you're using the `npm start` command which uses `serve`

### "Missing Supabase environment variables" Error
**Cause**: Environment variables not set or not prefixed with `VITE_`
**Solution**:
1. Verify environment variables are set in your platform
2. Ensure they're prefixed with `VITE_`
3. Rebuild the application after setting variables

### 404 Errors on Page Refresh
**Cause**: Server not configured for SPA routing
**Solution**: The `serve.json` file handles this automatically

### RLS Policy Violations During Signup
**Cause**: Missing tenant RLS policies
**Solution**: Apply the migration: `npx supabase db push`

### Build Failures
**Cause**: Missing dependencies or TypeScript errors
**Solution**:
```bash
npm install
npm run typecheck
npm run build
```

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] Database migrations are applied
- [ ] Can access the landing page
- [ ] Can sign up a new user
- [ ] User and tenant records are created in database
- [ ] Can sign in with created user
- [ ] Dashboard loads correctly
- [ ] Protected routes require authentication

## Testing Signup Flow

After deployment, test the complete signup flow:

1. Navigate to `/signup`
2. Fill out the form with valid data
3. Submit the form
4. Verify in Supabase dashboard:
   - User exists in `auth.users`
   - Tenant record created in `tenants` table
   - User profile created in `users` table
   - Subscription created in `subscriptions` table

## Monitoring

### Logs
Check your deployment platform's logs for errors:
- Build logs: Ensure build completes successfully
- Runtime logs: Check for JavaScript errors or API failures

### Database
Monitor Supabase dashboard for:
- RLS policy violations
- Failed queries
- User activity

## Security Considerations

### Environment Variables
- Never commit `.env` files to Git
- Use platform-specific secret management
- Rotate keys periodically

### Supabase
- Use Row Level Security (RLS) policies (already configured)
- Use anon key in frontend (not service role key)
- Configure allowed domains in Supabase dashboard

## Performance Optimization

### Caching
The `serve.json` configuration includes:
- No caching for HTML files (always fresh)
- Long-term caching for assets (images, fonts)

### Build Optimization
Vite automatically:
- Minifies JavaScript and CSS
- Code splits by route
- Optimizes assets
- Tree-shakes unused code

## Rollback Procedure

If deployment fails:

1. **Revert Code**:
   ```bash
   git revert HEAD
   git push
   ```

2. **Revert Database** (if needed):
   ```bash
   # In Supabase dashboard, use SQL editor to manually revert
   # Or use migration down scripts if available
   ```

3. **Redeploy Previous Version**: Most platforms allow redeploying previous deployments from their dashboard

## Support

For issues:
1. Check deployment platform logs
2. Check browser console for errors
3. Check Supabase logs
4. Review this troubleshooting guide
