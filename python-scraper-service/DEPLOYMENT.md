# Quick Deployment Guide

## Deploy to DigitalOcean in 5 Minutes

### Step 1: Push Code (If Not Already Done)

```bash
cd /home/user/dealer-copilot
git add python-scraper-service/
git commit -m "Add Python scraper with undetected-chromedriver"
git push origin claude/fix-scraping-consistency-014HPwtVZmpJSk97nMnsAsw6
```

### Step 2: Create App in DigitalOcean

1. Go to: https://cloud.digitalocean.com/apps
2. Click **"Create App"**
3. Choose **"GitHub"** as source
4. Authorize GitHub if needed
5. Select:
   - Repository: `gustavo-camilo/dealer-copilot`
   - Branch: `claude/fix-scraping-consistency-014HPwtVZmpJSk97nMnsAsw6`
   - Source Directory: `python-scraper-service`
6. Click **"Next"**

### Step 3: Configure Service

**Resources:**
- Detected Resource: Web Service
- Name: `python-scraper`

**Build Settings:**
- Build Command: (leave default - Dockerfile)
- Dockerfile Path: `python-scraper-service/Dockerfile`

**Run Command:**
- (leave default - uses CMD from Dockerfile)

**HTTP Port:** `3000`

**Health Check:**
- Path: `/health`
- Protocol: HTTP

Click **"Next"**

### Step 4: Environment Variables

Add these variables:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `PORT` | `3000` |

Click **"Next"**

### Step 5: Choose Plan

**Recommended: Professional**
- $24/month
- 1 GB RAM / 1 vCPU
- Good for production use

**Budget Option: Basic**
- $12/month
- 512 MB RAM / 1 vCPU
- May run out of memory under load

Click **"Next"**

### Step 6: Review and Deploy

1. Review settings
2. Click **"Create Resources"**
3. Wait 5-10 minutes for build

### Step 7: Get Your URL

Once deployed, you'll see:
```
https://python-scraper-xxxxx.ondigitalocean.app
```

Copy this URL!

### Step 8: Test It

```bash
# Health check
curl https://python-scraper-6tzlk.ondigitalocean.app/health

# Test Shopify site
curl -X POST https://python-scraper-6tzlk.ondigitalocean.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://rpm-motors.us"}' | jq .

# Test problem sites
curl -X POST https://python-scraper-6tzlk.ondigitalocean.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://nexautoga.com"}' | jq .
```

### Step 9: Update Edge Function (Optional)

If you want your Edge Function to use the Python scraper instead:

```bash
cd supabase

# Set the new scraper URL
supabase secrets set PYTHON_SCRAPER_URL=https://python-scraper-6tzlk.ondigitalocean.app

# Update the code
# In functions/scrape-dealer-inventory/index.ts
# Change PLAYWRIGHT_SERVICE_URL to:
# const SCRAPER_SERVICE_URL = Deno.env.get('PYTHON_SCRAPER_URL') || '...'

# Redeploy
supabase functions deploy scrape-dealer-inventory
```

## Troubleshooting

### Build Fails

Check build logs in DigitalOcean:
- Click on the app
- Go to "Build Logs"
- Look for errors

Common issues:
- Chrome installation fails → Retry build
- Out of memory → Upgrade to Professional plan

### Runtime Errors

Check runtime logs:
- Click on the app
- Go to "Runtime Logs"
- Look for Python errors

Common issues:
- `ANTHROPIC_API_KEY not set` → Add environment variable
- `Chrome not found` → Rebuild the app
- `Out of memory` → Upgrade plan

### Still Getting Bot Detected

If sites still block you:

1. **Add Proxies**:
   ```python
   # In scraper.py, modify __init__:
   options.add_argument('--proxy-server=http://your-proxy:port')
   ```

2. **Use ScraperAPI**:
   - Sign up: https://scraperapi.com
   - Add to requirements.txt: `scraperapi-sdk`
   - Wrap requests with ScraperAPI

3. **Contact Dealer**:
   - Ask for official API/feed access
   - Most reliable solution

## Monitoring

### Check Logs

```bash
# Using doctl (DigitalOcean CLI)
doctl apps logs <app-id>

# Or in web dashboard
# Apps → Your App → Runtime Logs
```

### Check Health

```bash
# Add to cron
*/5 * * * * curl https://python-scraper-xxxxx.ondigitalocean.app/health
```

### Monitor Success Rate

Track in your database:
```sql
SELECT
  COUNT(*) FILTER (WHERE vehicles_found > 0) * 100.0 / COUNT(*) as success_rate
FROM scrape_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## Costs

**Monthly Estimate:**
- DigitalOcean App: $24/month (Professional)
- Anthropic API: ~$5/month (if 100 scrapes/month hit Tier 4)
- **Total: ~$29/month**

**Per Scrape:**
- Tiers 1-3: $0 (free)
- Tier 4: ~$0.05 (only if others fail)

## Scaling

### Increase to 2 Workers

If you need more concurrency:

1. Edit `Dockerfile`
2. Change: `--workers 2` to `--workers 4`
3. Upgrade to Pro+ plan ($48/month, 2GB RAM)

### Add Redis Caching

To avoid re-scraping same sites:

1. Add Redis to DigitalOcean
2. Cache successful patterns
3. TTL: 24 hours

## Rollback

If you need to go back to Playwright:

1. In Edge Function, change URL back:
   ```bash
   supabase secrets set SCRAPER_SERVICE_URL=https://squid-app-vew3y.ondigitalocean.app
   ```

2. Keep both running and A/B test

## Success!

You should now have:
- ✅ Python scraper deployed
- ✅ Better bot detection bypass
- ✅ Same API endpoints
- ✅ Ready to handle problem sites

Test against your 3 sites and compare results!
