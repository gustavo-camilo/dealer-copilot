# Website Scraping Behavior Guide

## 🎯 Overview

The Dealer Co-Pilot scraping system has **two distinct modes** designed for efficiency and cost optimization:

1. **On-Demand Scraping** - User-triggered, single-tenant, immediate
2. **Scheduled Scraping** - Automated, multi-tenant, overnight

---

## 🚀 On-Demand Scraping (Manual)

### When It Happens:
- User clicks "Scan My Inventory" on the Onboarding page
- User clicks "Re-Scan My Website" to refresh data

### Behavior:
✅ **Only scrapes the requesting tenant's website**
✅ **Uses full resources for immediate results**
✅ **No queue or batching**

### Implementation:
```typescript
// OnboardingPage.tsx (Line 80-82)
const { data, error } = await supabase.functions.invoke('scrape-dealer-inventory', {
  body: { tenant_id: user.tenant_id },  // ← Only this tenant
});
```

```typescript
// scrape-dealer-inventory/index.ts (Line 140-142)
if (tenant_id) {
  query = query.eq('id', tenant_id);  // ← Filters to single tenant
}
```

### Cost:
- **Free** - Well within Supabase free tier limits
- Negligible server load since it's user-initiated

---

## ⏰ Scheduled Scraping (Automated)

### When It Happens:
- **Every day at 2:00 AM** (configurable)
- Runs automatically via pg_cron

### Behavior:
✅ **Scrapes ALL active/trial tenants with websites**
✅ **Runs during low-traffic hours** (overnight)
✅ **Batches all tenants in a single function call**
✅ **Respects rate limits and timeouts**

### Implementation:
```sql
-- Migration: 20251112000000_setup_scheduled_scraping.sql
SELECT cron.schedule(
  'daily-dealer-inventory-scraping',
  '0 2 * * *',  -- Daily at 2:00 AM
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/scrape-dealer-inventory',
    body := '{}'::jsonb  -- ← No tenant_id = scrape all
  );
  $$
);
```

### Cost:
- **$0/month** - Within free tier (500K executions/month)
- ~30 executions per month (1 per day)
- Minimal database storage (~2 MB/tenant/month)

---

## 🔍 How the System Differentiates

### Edge Function Logic:
```typescript
// Get request body (optional: can specify specific tenant)
const { tenant_id } = await req.json().catch(() => ({}));

// Build query
let query = supabase
  .from('tenants')
  .select('id, name, website_url')
  .not('website_url', 'is', null)
  .not('status', 'in', '("suspended","cancelled")');

// If tenant_id provided → scrape ONLY that tenant (on-demand)
if (tenant_id) {
  query = query.eq('id', tenant_id);
}
// If no tenant_id → scrape ALL tenants (scheduled)
```

---

## 💰 Cost Optimization Strategy

### Why This Design is Efficient:

#### 1. **On-Demand Scraping**
- User expects immediate results
- Only one website scraped per request
- Happens infrequently (user-triggered)
- **No wasted resources**

#### 2. **Scheduled Scraping**
- All websites scraped in **one batch** overnight
- Runs during **low server load** (2 AM)
- Only **once per day** per tenant
- Avoids hammering dealer websites
- **Maximum efficiency**

### Cost Breakdown:

| Scenario | Frequency | Cost |
|----------|-----------|------|
| On-demand scraping | User-triggered (~5-10 times/month) | $0 |
| Scheduled scraping | 1x/day (30x/month) | $0 |
| Database storage | ~2 MB/tenant/month | $0 (free tier) |
| **TOTAL** | | **$0/month** ✅ |

---

## 📊 Monitoring

### View Scraping Activity:
```sql
-- Recent scraping runs
SELECT
  s.snapshot_date,
  t.name as dealer_name,
  s.vehicles_found,
  s.status,
  s.scraping_duration_ms
FROM inventory_snapshots s
JOIN tenants t ON s.tenant_id = t.id
ORDER BY s.snapshot_date DESC
LIMIT 20;
```

### Check Scheduled Job Status:
```sql
-- Verify cron job exists
SELECT * FROM cron.job
WHERE jobname = 'daily-dealer-inventory-scraping';

-- View recent executions
SELECT * FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job
  WHERE jobname = 'daily-dealer-inventory-scraping'
)
ORDER BY start_time DESC
LIMIT 10;
```

---

## ⚙️ Configuration

### Change Schedule:
```sql
-- Run every 6 hours instead
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-dealer-inventory-scraping'),
  schedule := '0 */6 * * *'
);

-- Run twice daily (2 AM and 2 PM)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'daily-dealer-inventory-scraping'),
  schedule := '0 2,14 * * *'
);
```

### Disable Scheduled Scraping:
```sql
-- Temporarily disable
UPDATE cron.job
SET active = false
WHERE jobname = 'daily-dealer-inventory-scraping';

-- Re-enable
UPDATE cron.job
SET active = true
WHERE jobname = 'daily-dealer-inventory-scraping';

-- Delete completely
SELECT cron.unschedule('daily-dealer-inventory-scraping');
```

---

## 🚨 Best Practices

### 1. **Respect Website Policies**
- ✅ Only scrape public inventory pages
- ✅ Use proper User-Agent headers
- ✅ Respect robots.txt
- ✅ Add delays between requests

### 2. **Avoid Over-Scraping**
- ❌ Don't scrape more than once/day per tenant
- ❌ Don't run scheduled + manual simultaneously
- ❌ Don't hammer websites with rapid requests

### 3. **Monitor for Failures**
```sql
-- Find failing scrapes
SELECT * FROM scraping_logs
WHERE log_level = 'error'
ORDER BY created_at DESC;

-- Tenants with no successful scrapes
SELECT t.name, t.website_url
FROM tenants t
LEFT JOIN inventory_snapshots s ON t.id = s.tenant_id AND s.status = 'success'
WHERE t.website_url IS NOT NULL
  AND s.id IS NULL;
```

---

## 📋 Deployment Checklist

- [ ] Run migration: `20251112000000_setup_scheduled_scraping.sql`
- [ ] Configure database settings:
  ```sql
  ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
  ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
  ```
- [ ] Verify cron job created: `SELECT * FROM cron.job;`
- [ ] Test manual scraping from Onboarding page
- [ ] Wait 24 hours and verify scheduled scraping ran
- [ ] Check `inventory_snapshots` table for results

---

## 🎯 Summary

| Feature | On-Demand | Scheduled |
|---------|-----------|-----------|
| **Trigger** | User button click | Daily at 2 AM |
| **Scope** | Single tenant | All tenants |
| **Speed** | Immediate | Background |
| **Resources** | Full power | Rate-limited |
| **Cost** | $0 | $0 |
| **Purpose** | Quick refresh | Daily sync |

**Result**: Maximum efficiency, zero cost, best user experience! ✅
