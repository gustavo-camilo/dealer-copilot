# Website Scraping - Quick Start Summary

## 📦 **WHAT WE BUILT**

A complete automated website scraping system that:
- ✅ Scrapes dealer websites daily
- ✅ Tracks vehicle listings over time
- ✅ Detects price changes automatically
- ✅ Identifies sold vehicles (when they disappear)
- ✅ Builds sales history for AI recommendations
- ✅ Costs $0/month (Supabase free tier)

---

## 📁 **FILES CREATED**

### **Database:**
- `SCRAPING_DATABASE_MIGRATION.sql` - Database schema (3 tables + triggers)

### **Edge Function:**
- `supabase/functions/scrape-dealer-inventory/index.ts` - Main scraping logic
- `supabase/functions/scrape-dealer-inventory/parser.ts` - HTML parser (multiple strategies)
- `supabase/functions/_shared/cors.ts` - CORS headers

### **Documentation:**
- `SCRAPING_DEPLOYMENT_GUIDE.md` - Complete deployment steps
- `WEBSITE_SCRAPING_PLAN.md` - Full architecture documentation
- `WEBSITE_SCRAPING_SUMMARY.md` - This file

---

## 🚀 **DEPLOYMENT (5 STEPS)**

### **1. Run Database Migration**
```
Supabase Dashboard → SQL Editor → Run SCRAPING_DATABASE_MIGRATION.sql
```

### **2. Install & Link Supabase CLI**
```bash
npm install -g supabase
supabase login
supabase link --project-ref ueoovsjhaxykewtsnbqx
```

### **3. Deploy Edge Function**
```bash
supabase functions deploy scrape-dealer-inventory
```

### **4. Set Secrets**
```bash
supabase secrets set SUPABASE_URL=https://ueoovsjhaxykewtsnbqx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **5. Enable Daily Cron**
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-dealer-scraping',
  '0 2 * * *',  -- 2 AM daily
  $$
  SELECT net.http_post(
    url := 'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## 🧪 **TESTING**

### **Manual Trigger:**
```bash
curl -X POST \
  'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### **Check Results:**
```sql
-- View recent scraping runs
SELECT * FROM inventory_snapshots ORDER BY snapshot_date DESC LIMIT 10;

-- View tracked vehicles
SELECT * FROM vehicle_history ORDER BY last_seen_at DESC LIMIT 20;

-- View scraping logs
SELECT * FROM scraping_logs ORDER BY created_at DESC LIMIT 50;
```

---

## 🔄 **HOW IT WORKS**

### **Daily Workflow:**

1. **Cron Triggers** (2 AM daily)
   ↓
2. **Edge Function Runs**
   - Fetches all active tenants with website_url
   - For each tenant:
     - Fetches dealer website HTML
     - Parses vehicle listings
     - Compares with yesterday's data
   ↓
3. **Database Updates:**
   - **New vehicles** → INSERT into vehicle_history
   - **Existing vehicles** → UPDATE last_seen_at
   - **Price changes** → Add to price_history array
   - **Missing vehicles** (2+ days) → Mark as SOLD
   ↓
4. **Automatic Sales Records:**
   - Trigger creates sales_record when status = 'sold'
   - Calculates days_to_sale automatically
   - Records last known price as sale_price

---

## 📊 **DATABASE TABLES**

### **1. inventory_snapshots**
Stores raw snapshots from each scraping run
- `tenant_id` - Which dealer
- `snapshot_date` - When scraped
- `vehicles_found` - How many vehicles
- `raw_data` - Full JSON of vehicles
- `status` - success/failed/partial

### **2. vehicle_history**
Tracks individual vehicles over time
- `vin`, `make`, `model`, `year`, `price`, `mileage`
- `first_seen_at` - When first appeared
- `last_seen_at` - Last time seen on website
- `days_listed` - Auto-calculated
- `status` - active/sold/price_changed
- `price_history` - Array of price changes

### **3. scraping_logs**
Detailed logs for debugging
- `log_level` - debug/info/warning/error
- `message` - What happened
- `details` - JSON with extra info

---

## 🎯 **KEY FEATURES**

### **Multi-Platform Support:**
The parser tries multiple strategies:
1. **JSON-LD/Schema.org** - Structured data (best)
2. **Common Platforms** - WordPress, Dealix, etc.
3. **Data Attributes** - data-vin, data-price, etc.
4. **Generic Patterns** - Finds vehicle cards automatically

### **Automatic Sales Detection:**
- Vehicle not seen for 2+ days → Marked as SOLD
- Automatically creates sales_record
- Calculates days_to_sale from first_seen_at to last_seen_at
- Uses last listing price as sale_price

### **Price History Tracking:**
- Every price change is logged
- Stored as JSON array: `[{date, price}, {date, price}]`
- Used for trend analysis

---

## 🎨 **CUSTOMIZING THE PARSER**

If the generic parser doesn't work for your dealer's website:

### **1. Inspect the Website:**
```bash
# View source
curl "https://dealer-website.com/inventory" > test.html
```

### **2. Find Vehicle Patterns:**
Look for:
- Repeating HTML structures (divs with class="vehicle")
- Data attributes (data-vin, data-price)
- JSON-LD scripts
- Vehicle cards/listings

### **3. Add Custom Parser:**

Edit `supabase/functions/scrape-dealer-inventory/parser.ts`:

```typescript
function parseYourDealerSite(html: string, baseUrl: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Your custom parsing logic here
  // Example:
  const regex = /<div class="vehicle-card" data-vin="([^"]+)".*?data-price="([^"]+)"/gs;
  const matches = [...html.matchAll(regex)];

  for (const match of matches) {
    vehicles.push({
      vin: match[1],
      price: parseFloat(match[2]),
      // ... extract other fields
    });
  }

  return vehicles;
}
```

### **4. Redeploy:**
```bash
supabase functions deploy scrape-dealer-inventory
```

---

## 🔍 **MONITORING**

### **Dashboard Queries:**

**Scraping Health Check:**
```sql
SELECT
  DATE(snapshot_date) as date,
  COUNT(*) as runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  AVG(vehicles_found) as avg_vehicles,
  AVG(scraping_duration_ms) as avg_duration_ms
FROM inventory_snapshots
WHERE snapshot_date >= NOW() - INTERVAL '7 days'
GROUP BY DATE(snapshot_date)
ORDER BY date DESC;
```

**Recent Sales:**
```sql
SELECT
  t.name as dealer,
  vh.year || ' ' || vh.make || ' ' || vh.model as vehicle,
  vh.price as sale_price,
  vh.days_listed,
  vh.last_seen_at as sold_date
FROM vehicle_history vh
JOIN tenants t ON vh.tenant_id = t.id
WHERE vh.status = 'sold'
  AND vh.last_seen_at >= NOW() - INTERVAL '30 days'
ORDER BY vh.last_seen_at DESC;
```

**Price Drops:**
```sql
SELECT
  vin,
  year || ' ' || make || ' ' || model as vehicle,
  price_history->>0 as initial_price,
  price_history->>-1 as current_price,
  (price_history->>0)::numeric - (price_history->>-1)::numeric as price_drop
FROM vehicle_history
WHERE jsonb_array_length(price_history) > 1
  AND status = 'active'
ORDER BY price_drop DESC
LIMIT 20;
```

---

## 💡 **TIPS**

### **Best Practices:**
1. **Test manually first** before enabling cron
2. **Start with 1 dealer** and verify accuracy
3. **Monitor logs daily** for first week
4. **Customize parser** if generic version doesn't work
5. **Keep scraping respectful** (don't hammer websites)

### **Performance:**
- Scraping typically takes 2-5 seconds per dealer
- Function timeout: 50 seconds max
- If timing out: Split into multiple tenants per run

### **Data Quality:**
- VIN is most reliable identifier
- Stock numbers work if VINs aren't available
- Prices should include actual listing price (not MSRP)
- Verify mileage format (miles vs kilometers)

---

## 🎓 **LEARNING THE SYSTEM**

### **How Sales Detection Works:**

```
DAY 1: Vehicle appears on website
  └─> INSERT into vehicle_history (first_seen_at = today)

DAY 2-30: Vehicle still on website
  └─> UPDATE last_seen_at = today

DAY 31: Vehicle disappears
  └─> Still in database with last_seen_at = Day 30

DAY 33: Scraper runs, vehicle not found
  └─> Checks: last_seen_at < (today - 2 days)?
  └─> YES → UPDATE status = 'sold'
  └─> Trigger fires → INSERT into sales_records
      └─> days_to_sale = 30
      └─> sale_price = last known price
```

---

## 📞 **SUPPORT**

### **Common Issues:**

**"No vehicles found"**
→ Parser doesn't match site structure
→ Customize parser for your platform

**"Function timeout"**
→ Website too slow or too large
→ Consider splitting scraping into batches

**"Duplicate sales records"**
→ VIN tracking not working
→ Check if VINs are being extracted correctly

**"Wrong prices"**
→ Parser extracting wrong text
→ Inspect HTML and adjust regex patterns

---

## 🎉 **SUCCESS CHECKLIST**

- [ ] Database migration completed
- [ ] Edge function deployed
- [ ] Secrets configured
- [ ] Manual test successful
- [ ] Cron job scheduled
- [ ] First automatic run completed
- [ ] Data verified in database
- [ ] Parser customized (if needed)
- [ ] Monitoring queries tested

---

**Total Setup Time:** 30-60 minutes
**Monthly Cost:** $0
**Maintenance:** ~5 minutes/week

**Ready to deploy?** Follow the [SCRAPING_DEPLOYMENT_GUIDE.md](SCRAPING_DEPLOYMENT_GUIDE.md)! 🚀
