# Website Scraping Deployment Guide

## 🚀 **COMPLETE DEPLOYMENT STEPS**

Follow these steps in order to deploy the website scraping system.

---

## **STEP 1: Run Database Migration** ✅

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** → **"New Query"**
4. Open `SCRAPING_DATABASE_MIGRATION.sql`
5. Copy all contents and paste into SQL Editor
6. Click **"Run"**

**Expected Output:**
```
✅ Website scraping database schema created successfully!
```

**Verify:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('inventory_snapshots', 'vehicle_history', 'scraping_logs');
```

Should return 3 tables.

---

## **STEP 2: Install Supabase CLI**

```bash
# Install globally
npm install -g supabase

# Login to Supabase
supabase login
```

Follow the prompts to authenticate.

---

## **STEP 3: Link Project**

```bash
cd /Users/gustavocamilo/Documents/GitHub/dealer-copilot

# Link to your Supabase project
supabase link --project-ref ueoovsjhaxykewtsnbqx
```

---

## **STEP 4: Deploy Edge Function**

```bash
# Deploy the scraping function
supabase functions deploy scrape-dealer-inventory --project-ref ueoovsjhaxykewtsnbqx
```

**Expected Output:**
```
Deploying function scrape-dealer-inventory (project ref: ueoovsjhaxykewtsnbqx)
✓ Function deployed successfully
✓ URL: https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory
```

---

## **STEP 5: Set Environment Variables**

The Edge Function needs your Supabase credentials:

```bash
# Get your service role key from Supabase Dashboard → Settings → API
# IMPORTANT: This is your SECRET key, don't share it!

supabase secrets set SUPABASE_URL=https://ueoovsjhaxykewtsnbqx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Where to find Service Role Key:**
1. Supabase Dashboard → Settings → API
2. Copy the **service_role secret** (NOT the anon public key)

---

## **STEP 6: Test Manual Trigger**

Test the function manually before setting up cron:

```bash
# Using curl
curl -X POST \
  'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Scraped X tenant(s) in XXXms",
  "results": [
    {
      "tenant_name": "Test Dealer",
      "vehicles_found": 15,
      "new_vehicles": 3,
      "updated_vehicles": 12,
      "sold_vehicles": 0,
      "status": "success"
    }
  ]
}
```

---

## **STEP 7: Set Up Daily Cron Job**

### **Option A: Using pg_cron (Recommended)**

Run this SQL in Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily scraping at 2 AM EST
SELECT cron.schedule(
  'daily-dealer-scraping',           -- Job name
  '0 2 * * *',                       -- Cron expression (2 AM daily)
  $$
  SELECT net.http_post(
    url := 'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job;
```

**Cron Schedule Options:**
- `0 2 * * *` = Daily at 2 AM
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Weekly on Sunday at midnight
- `0 9,17 * * *` = Twice daily (9 AM and 5 PM)

---

### **Option B: Using External Cron Service**

If pg_cron doesn't work, use a service like:

**1. EasyCron (Free tier available)**
- URL: `https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory`
- Method: POST
- Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- Schedule: Daily at 2 AM

**2. Render Cron Jobs**
- Deploy a simple cron job that calls your function
- $7/month for dedicated cron worker

---

## **STEP 8: Monitor Scraping Results**

### **View Recent Snapshots:**

```sql
SELECT
  s.snapshot_date,
  t.name as dealer_name,
  s.vehicles_found,
  s.status,
  s.scraping_duration_ms,
  s.error_message
FROM inventory_snapshots s
JOIN tenants t ON s.tenant_id = t.id
ORDER BY s.snapshot_date DESC
LIMIT 20;
```

### **View Vehicle History:**

```sql
SELECT
  vin,
  year || ' ' || make || ' ' || model as vehicle,
  price,
  status,
  first_seen_at,
  last_seen_at,
  days_listed
FROM vehicle_history
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY last_seen_at DESC
LIMIT 50;
```

### **Find Sold Vehicles:**

```sql
SELECT
  vh.vin,
  vh.year || ' ' || vh.make || ' ' || vh.model as vehicle,
  vh.price as last_price,
  vh.days_listed,
  sr.sale_date
FROM vehicle_history vh
LEFT JOIN sales_records sr ON vh.vin = sr.vin AND vh.tenant_id = sr.tenant_id
WHERE vh.status = 'sold'
  AND vh.tenant_id = 'YOUR_TENANT_ID'
ORDER BY vh.last_seen_at DESC;
```

---

## **STEP 9: Customize Parser for Your Dealer Website**

The generic parser works for many sites, but you may need to customize it.

### **Test What's Being Scraped:**

1. Run manual trigger (Step 6)
2. Check `inventory_snapshots` table → `raw_data` column
3. See what data was extracted

### **Customize Parser:**

Edit `supabase/functions/scrape-dealer-inventory/parser.ts`:

```typescript
// Add custom logic for your specific dealer platform
function parseYourDealerPlatform(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Example: Extract from specific HTML structure
  const vehicleCards = html.match(/<div class="inventory-card">(.*?)<\/div>/gs);

  vehicleCards?.forEach(card => {
    vehicles.push({
      vin: card.match(/VIN:\s*([A-Z0-9]{17})/)?.[1],
      year: parseInt(card.match(/Year:\s*(\d{4})/)?.[1] || '0'),
      make: card.match(/Make:\s*(\w+)/)?.[1],
      model: card.match(/Model:\s*([\w\s]+)/)?.[1],
      price: parseFloat(card.match(/\$(\d+,\d+)/)?.[1]?.replace(',', '') || '0'),
    });
  });

  return vehicles;
}
```

**Redeploy after changes:**
```bash
supabase functions deploy scrape-dealer-inventory
```

---

## **STEP 10: Create Admin Dashboard Page** (Optional)

Add a page to view scraping results in your app.

**File:** `src/pages/AdminScrapingDashboard.tsx`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminScrapingDashboard() {
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    async function fetchSnapshots() {
      const { data } = await supabase
        .from('inventory_snapshots')
        .select(`
          *,
          tenants(name)
        `)
        .order('snapshot_date', { ascending: false })
        .limit(50);

      setSnapshots(data || []);
    }

    fetchSnapshots();
  }, []);

  return (
    <div>
      <h1>Website Scraping Dashboard</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Dealer</th>
            <th>Vehicles Found</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map(snapshot => (
            <tr key={snapshot.id}>
              <td>{new Date(snapshot.snapshot_date).toLocaleString()}</td>
              <td>{snapshot.tenants?.name}</td>
              <td>{snapshot.vehicles_found}</td>
              <td>{snapshot.status}</td>
              <td>{snapshot.scraping_duration_ms}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## **TROUBLESHOOTING**

### **Problem: Function times out**
- **Solution:** Reduce timeout or split into multiple functions
- Check `scraping_logs` table for errors

### **Problem: No vehicles found**
- **Solution:** Parser doesn't match website structure
- Inspect website HTML and customize parser
- Check `raw_data` in snapshots to see what's being captured

### **Problem: Cron job not running**
- **Solution:** Verify pg_cron is enabled
- Check cron job exists: `SELECT * FROM cron.job;`
- View cron logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`

### **Problem: CORS errors**
- **Solution:** Already handled in function, but ensure headers are correct
- Check browser console for specific error

---

## **COST MONITORING**

### **Supabase Edge Functions:**
- **Free Tier:** 500,000 invocations/month
- **Your Usage:** ~30-60 calls/month (1-2 per day per tenant)
- **Cost:** $0 (well within free tier)

### **Database Storage:**
- **Estimate:** ~2 MB/month per tenant
- **Cost:** Included in free tier (up to 500 MB)

### **Network Bandwidth:**
- **Estimate:** ~50 MB/month (HTML downloads)
- **Cost:** Included in free tier (up to 2 GB)

**Total Monthly Cost: $0** 🎉

---

## **NEXT STEPS**

After deployment:

1. ✅ Monitor first few scraping runs
2. ✅ Verify data is accurate
3. ✅ Customize parser if needed
4. ✅ Add more dealer websites
5. ✅ Build admin dashboard (optional)
6. ✅ Set up email alerts for failures (optional)

---

## **QUICK REFERENCE**

### **Manually Trigger Scraping:**
```bash
curl -X POST 'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### **Scrape Specific Tenant:**
```bash
curl -X POST 'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id": "YOUR_TENANT_UUID"}'
```

### **View Logs:**
```sql
SELECT * FROM scraping_logs
ORDER BY created_at DESC
LIMIT 100;
```

### **Delete Cron Job:**
```sql
SELECT cron.unschedule('daily-dealer-scraping');
```

---

**Ready to deploy?** Start with Step 1! 🚀
