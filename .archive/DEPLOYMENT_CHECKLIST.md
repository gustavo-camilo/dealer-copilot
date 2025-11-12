# Deployment Checklist - Fix Blank Page Issue

## The Problem
Your app shows a blank page with the error:
```
Uncaught Error: Missing Supabase environment variables
```

This happens because Vite embeds environment variables at **build time**, and your deployment platform doesn't have them set.

## Quick Fix (Follow in Order)

### Step 1: Get Your Supabase Credentials
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy these two values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

### Step 2: Add Environment Variables to Your Deployment Platform

Choose your platform:

#### **Render**
1. Go to your service dashboard
2. Click **Environment** in the left sidebar
3. Add two environment variables:
   - Key: `VITE_SUPABASE_URL` → Value: (paste your Project URL)
   - Key: `VITE_SUPABASE_ANON_KEY` → Value: (paste your anon key)
4. Click **Save Changes**

#### **Vercel**
1. Go to your project
2. Click **Settings** → **Environment Variables**
3. Add both variables (same as above)
4. Make sure they're enabled for Production
5. Click **Save**

#### **Railway**
1. Go to your project
2. Click **Variables** tab
3. Click **+ New Variable**
4. Add both variables (same as above)

#### **Netlify**
1. Go to **Site configuration** → **Environment variables**
2. Add both variables (same as above)
3. Click **Save**

#### **Heroku**
1. Go to your app dashboard
2. Click **Settings** → **Config Vars** → **Reveal Config Vars**
3. Add both variables (same as above)

### Step 3: Trigger a Rebuild
After adding the environment variables, you MUST rebuild:

- **Render**: Click **Manual Deploy** → **Deploy latest commit**
- **Vercel**: Go to **Deployments** → Click the three dots → **Redeploy**
- **Railway**: Click **Deploy** or push a new commit
- **Netlify**: Click **Trigger deploy** → **Deploy site**
- **Heroku**: `git commit --allow-empty -m "Trigger rebuild" && git push heroku main`

### Step 4: Apply Database Migration (Also Critical!)
The RLS policies also need to be fixed. Run this command locally:

```bash
npx supabase db push
```

This applies the migration that fixes the "new row violates row-level security policy for table 'tenants'" error.

### Step 5: Verify It Works
1. Wait for deployment to complete (check logs)
2. Visit your deployed URL
3. You should now see the landing page (not a blank page!)
4. Navigate to `/signup`
5. Try creating a test account
6. Verify it works without RLS errors

## Common Mistakes

❌ **Setting variables without rebuilding** - Variables are embedded at build time
❌ **Missing the `VITE_` prefix** - Must be `VITE_SUPABASE_URL`, not just `SUPABASE_URL`
❌ **Using service_role key instead of anon key** - Use the anon/public key
❌ **Not applying the database migration** - Run `npx supabase db push`

## Still Not Working?

### Check Build Logs
Look for these in your platform's build logs:
```
✓ built in Xms
```

If you see errors, the build failed.

### Check Browser Console
Open DevTools (F12) → Console tab
- No errors? → Environment variables are working
- "Missing Supabase environment variables"? → Variables not set or rebuild needed
- Other errors? → Check the error message

### Check Environment Variables Were Applied
Add this temporarily to verify (then remove):

In `src/lib/supabase.ts`, add console logs:
```typescript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has anon key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

Deploy again and check the console. If they're undefined, the variables weren't embedded during build.

## Need More Help?

See the full [DEPLOYMENT.md](./DEPLOYMENT.md) guide for detailed platform-specific instructions.
