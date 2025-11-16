# Deployment Guide

This guide walks you through deploying the Playwright Scraper Service to production.

## 🚨 Recent Updates (IMPORTANT)

### Latest Fix: SSL/TLS Certificate Errors (2024-11-16)

**Issues Resolved:**
- ✅ Fixed `TLS_error:CERTIFICATE_VERIFY_FAILED` errors in DigitalOcean App Platform
- ✅ Updated Claude model from deprecated `claude-3-5-sonnet-20240620` to stable `claude-3-5-sonnet-20241022`
- ✅ Added browser flags for containerized environments

**Files Changed:**
- `src/scraper.ts` - Added SSL/TLS certificate handling flags
- `src/tier4-llm-vision.ts` - Updated Claude API model version

**Action Required:** If you're experiencing scraping failures, redeploy immediately using instructions below.

---

## Prerequisites

- [ ] Supabase project with database access
- [ ] Anthropic API key (sign up at https://console.anthropic.com)
- [ ] GitHub account (for Railway deployment)
- [ ] Credit card for Railway ($10-20/month)

## Step-by-Step Deployment

### Part 1: Prepare Your Code

#### 1. Create GitHub Repository

```bash
cd playwright-scraper-service

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Playwright scraper service"

# Create repo on GitHub (via web interface)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/playwright-scraper-service.git
git branch -M main
git push -u origin main
```

#### 2. Run Database Migration

1. Go to your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-migration.sql`
5. Click **Run** to create the pattern cache table
6. Verify: Go to **Table Editor** and you should see `scraper_domain_patterns` table

### Part 2: Deploy to Railway

#### 1. Sign Up for Railway

1. Go to https://railway.app
2. Click **Login with GitHub**
3. Authorize Railway to access your GitHub account
4. Add a payment method (required even for free tier)

#### 2. Create New Project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Select your `playwright-scraper-service` repository
4. Railway will detect the Dockerfile automatically

#### 3. Configure Environment Variables

1. In your Railway project, click on the service
2. Go to **Variables** tab
3. Add the following environment variables:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
PORT=3000
```

**Where to find these:**

- **SUPABASE_URL**: Supabase Dashboard → Settings → API → Project URL
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → Project API keys → `service_role` key (click to reveal)
- **ANTHROPIC_API_KEY**: https://console.anthropic.com → API Keys → Create Key

#### 4. Deploy

1. Railway will automatically start deploying after you add environment variables
2. Wait 5-10 minutes for the build to complete
3. Once deployed, click **Settings** → **Generate Domain** to get a public URL
4. Your service will be available at: `https://your-service.railway.app`

#### 5. Test Deployment

```bash
# Test health check
curl https://your-service.railway.app/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T10:30:00.000Z"}

# Test scrape endpoint
curl -X POST https://your-service.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-dealer-website.com/inventory"}'
```

### Part 3: Integrate with Supabase Edge Functions

#### 1. Update Edge Function

Add this environment variable to your Supabase Edge Function:

1. Go to Supabase Dashboard → Edge Functions
2. Select `scrape-dealer-inventory`
3. Click **Settings**
4. Add environment variable:
   - Name: `PLAYWRIGHT_SERVICE_URL`
   - Value: `https://your-service.railway.app`

#### 2. Update Edge Function Code

The Edge Function should call your Playwright service instead of doing scraping directly.

Example integration (add to your Edge Function):

```typescript
// At the top of your Edge Function
const PLAYWRIGHT_SERVICE_URL = Deno.env.get('PLAYWRIGHT_SERVICE_URL');

// Replace the scraping logic with:
async function scrapeWithPlaywright(url: string) {
  try {
    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, useCachedPattern: true }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Playwright scraped ${result.vehicles.length} vehicles using Tier ${result.tier}`);
      return result.vehicles;
    } else {
      console.error('Playwright scrape failed:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Failed to call Playwright service:', error);
    // Fallback to old scraping method if needed
    return [];
  }
}

// Use it in your scraping logic:
const vehicles = await scrapeWithPlaywright(inventoryUrl);
```

### Part 4: Monitoring & Maintenance

#### 1. View Logs in Railway

1. Go to your Railway project
2. Click on the service
3. Click **Deployments** tab
4. Click on the latest deployment
5. View real-time logs

#### 2. Monitor Costs

1. Railway Dashboard → Account Settings → Usage
2. Expected cost: $10-20/month for this service
3. Anthropic Console → Usage → Check API costs (~$5-10/month)

#### 3. Update the Service

```bash
# Make changes to code
git add .
git commit -m "Update scraper"
git push

# Railway will automatically redeploy
```

---

## Deploy to DigitalOcean App Platform

DigitalOcean App Platform is a good alternative to Railway with competitive pricing and good performance.

### 1. Prerequisites

- DigitalOcean account (sign up at https://cloud.digitalocean.com)
- GitHub repository with your code (already done if following this guide)
- Payment method added to DigitalOcean

### 2. Create New App

1. Go to https://cloud.digitalocean.com/apps
2. Click **Create App**
3. Select **GitHub** as source
4. Choose your repository
5. Select the branch (e.g., `main` or your feature branch)
6. Click **Next**

### 3. Configure App

**App Settings:**
- **Type**: Web Service
- **Dockerfile Path**: `Dockerfile` (auto-detected)
- **HTTP Port**: 3000
- **HTTP Request Routes**: `/`

**Resources:**
- **Plan**: Basic ($5/month minimum)
- **RAM**: 512 MB (minimum) or 1 GB (recommended)
- **CPU**: 1 vCPU

Click **Next**

### 4. Set Environment Variables

Click **Edit** next to Environment Variables and add:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-api-key
PORT=3000
```

**Important**: Mark sensitive variables (API keys) as **Encrypted**

Click **Next**

### 5. Deploy

1. Review your configuration
2. Click **Create Resources**
3. Wait 5-10 minutes for deployment
4. Once deployed, you'll get a URL like: `https://your-app-name.ondigitalocean.app`

### 6. Test Deployment

```bash
# Test health endpoint
curl https://your-app-name.ondigitalocean.app/health

# Test scraping
curl -X POST https://your-app-name.ondigitalocean.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://rpm-motors.us","useCachedPattern":true}'
```

### 7. Update Existing Deployment (IMPORTANT FOR FIXES)

If you've already deployed and need to apply the latest SSL/TLS fixes:

**Option A: Force Rebuild (Fastest)**
1. Go to your app in DigitalOcean dashboard
2. Click **Settings** tab
3. Scroll to **App-Level Configuration**
4. Click **Force Rebuild and Deploy**
5. Confirm - this will pull latest code and rebuild

**Option B: Trigger via Git Push**
1. Push your latest changes to GitHub
2. DigitalOcean auto-deploys on git push (if enabled)
3. Monitor deployment in **Activity** tab

**Option C: Using doctl CLI**
```bash
# Install doctl
brew install doctl  # macOS
# or
snap install doctl  # Linux

# Authenticate
doctl auth init

# List apps
doctl apps list

# Create deployment
doctl apps create-deployment <APP_ID>
```

### 8. Monitor Logs

1. Go to your app dashboard
2. Click **Runtime Logs** tab
3. Look for:
   ```
   ✅ Browser initialized
   🚀 Playwright Scraper Service
   Running on port 3000
   ✅ Ready to accept requests
   ```

### DigitalOcean Troubleshooting

**Issue: "Build failed"**
- Check build logs for specific error
- Verify Dockerfile is correct
- Ensure all npm packages are in package.json

**Issue: "App crashes on startup"**
- Check environment variables are set
- View runtime logs for error messages
- Common cause: missing env vars (service exits immediately)

**Issue: "Out of memory"**
- Upgrade to 1 GB RAM plan
- Go to Settings → Resources → Edit Plan

**Issue: "SSL/TLS certificate errors"**
- Ensure you've deployed the latest code with certificate fixes
- Force rebuild if needed (see step 7)
- Check that browser flags are present in `scraper.ts`

---

## Alternative: Deploy to Fly.io (Advanced)

If you prefer Fly.io (better for high volume), follow these steps:

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Sign Up & Login

```bash
fly auth signup
fly auth login
```

### 3. Create fly.toml

```bash
cd playwright-scraper-service
fly launch --no-deploy
```

Edit the generated `fly.toml`:

```toml
app = "your-app-name"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.http_checks]]
    interval = "30s"
    timeout = "10s"
    path = "/health"
```

### 4. Set Environment Variables

```bash
fly secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
fly secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
```

### 5. Deploy

```bash
fly deploy
```

### 6. Get URL

```bash
fly info
# Your service will be at: https://your-app-name.fly.dev
```

---

## Troubleshooting

### Deployment fails with "Out of memory"

**Railway:**
- Upgrade to a paid plan ($5/month for 2GB RAM)

**Fly.io:**
```bash
fly scale memory 2048
```

### "Browser failed to launch"

Check logs for missing dependencies. The Dockerfile should include all necessary packages, but if you see errors:

1. SSH into the container (Railway/Fly.io both support this)
2. Run: `npx playwright install-deps chromium`

### Scraper returns empty results

1. Check logs to see which tier failed
2. Test locally first: `npm run dev`
3. Verify environment variables are set correctly
4. Check if dealer website blocks your IP (rare on Railway/Fly.io)

### Claude API errors

1. Verify API key is correct
2. Check Anthropic Console for rate limits/quota
3. The service rarely uses Claude (only Tier 4), so costs should be low

---

## Success Checklist

- [ ] GitHub repository created and pushed
- [ ] Database migration run in Supabase
- [ ] Railway/Fly.io project created
- [ ] Environment variables configured
- [ ] Service deployed successfully
- [ ] Health check returns healthy
- [ ] Test scrape returns vehicles
- [ ] Edge Function environment variable added
- [ ] Edge Function updated to call Playwright service
- [ ] Monitor logs to ensure everything works

**You're done!** 🎉

Your scraper is now production-ready and will handle any dealer website structure automatically.
