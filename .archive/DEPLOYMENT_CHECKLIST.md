# 🎯 Website Scraping - Deployment Checklist

Use this checklist to deploy the website scraping system step-by-step.

---

## ✅ **PRE-DEPLOYMENT**

- [ ] VIN Decoder is working correctly
- [ ] Have at least 1 dealer with `website_url` in database
- [ ] Supabase account is active
- [ ] Have access to Supabase Dashboard

---

## 📊 **STEP 1: DATABASE SETUP** (5 min)

- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Create New Query
- [ ] Copy contents of `SCRAPING_DATABASE_MIGRATION.sql`
- [ ] Paste and click "Run"
- [ ] Verify success message: ✅ "Website scraping database schema created successfully!"
- [ ] Run verification query:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('inventory_snapshots', 'vehicle_history', 'scraping_logs');
  ```
- [ ] Confirm 3 tables returned

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 🛠️ **STEP 2: CLI SETUP** (10 min)

- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Login: `supabase login`
- [ ] Navigate to project: `cd /Users/gustavocamilo/Documents/GitHub/dealer-copilot`
- [ ] Link project: `supabase link --project-ref ueoovsjhaxykewtsnbqx`
- [ ] Verify link successful

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 🚀 **STEP 3: DEPLOY FUNCTION** (5 min)

- [ ] Deploy command: `supabase functions deploy scrape-dealer-inventory`
- [ ] Note the function URL from output
- [ ] Copy URL: `https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 🔐 **STEP 4: CONFIGURE SECRETS** (5 min)

- [ ] Get Service Role Key from Supabase Dashboard → Settings → API
- [ ] Set SUPABASE_URL secret:
  ```bash
  supabase secrets set SUPABASE_URL=https://ueoovsjhaxykewtsnbqx.supabase.co
  ```
- [ ] Set SERVICE_ROLE_KEY secret:
  ```bash
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_actual_key_here
  ```
- [ ] Verify secrets set: `supabase secrets list`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 🧪 **STEP 5: MANUAL TEST** (10 min)

### First Test - Check Function Works:

- [ ] Save your Service Role Key to a variable:
  ```bash
  export SERVICE_ROLE_KEY="your_key_here"
  ```

- [ ] Test the function:
  ```bash
  curl -X POST \
    'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d '{}'
  ```

- [ ] Expected response includes: `"success": true`
- [ ] Note: vehicles_found, new_vehicles, etc.

### Verify Data in Database:

- [ ] Check inventory_snapshots:
  ```sql
  SELECT * FROM inventory_snapshots ORDER BY snapshot_date DESC LIMIT 5;
  ```

- [ ] Check vehicle_history:
  ```sql
  SELECT * FROM vehicle_history ORDER BY last_seen_at DESC LIMIT 10;
  ```

- [ ] Check scraping_logs:
  ```sql
  SELECT * FROM scraping_logs ORDER BY created_at DESC LIMIT 10;
  ```

### Test Results:
- [ ] Vehicles found: _____ (write number)
- [ ] New vehicles added: _____
- [ ] Errors encountered: _____ (should be 0)

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## ⏰ **STEP 6: ENABLE DAILY CRON** (5 min)

- [ ] Open Supabase SQL Editor
- [ ] Create New Query
- [ ] Paste cron setup SQL:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  SELECT cron.schedule(
    'daily-dealer-scraping',
    '0 2 * * *',
    $$
    SELECT net.http_post(
      url := 'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    $$
  );
  ```
- [ ] Replace `YOUR_SERVICE_ROLE_KEY_HERE` with actual key
- [ ] Run the query
- [ ] Verify cron job created:
  ```sql
  SELECT * FROM cron.job;
  ```
- [ ] Confirm job named "daily-dealer-scraping" exists

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 🎨 **STEP 7: CUSTOMIZE PARSER** (Optional - 30 min)

Only if generic parser doesn't extract vehicles correctly.

- [ ] Save dealer website HTML to file:
  ```bash
  curl "https://dealer-website.com/inventory" > test.html
  ```

- [ ] Open test.html and inspect structure
- [ ] Identify vehicle card pattern
- [ ] Edit `supabase/functions/scrape-dealer-inventory/parser.ts`
- [ ] Add custom parsing logic
- [ ] Redeploy: `supabase functions deploy scrape-dealer-inventory`
- [ ] Re-test with manual trigger
- [ ] Verify improved results

**Status:** ⬜ Not Needed | 🟡 In Progress | ✅ Complete | ❌ Failed

---

## 📊 **STEP 8: MONITOR FIRST WEEK** (Daily - 5 min)

### Day 1 (Deployment Day):
- [ ] Manual test completed successfully
- [ ] Cron scheduled for tomorrow 2 AM

### Day 2 (After First Automatic Run):
- [ ] Check if cron ran:
  ```sql
  SELECT * FROM inventory_snapshots
  WHERE snapshot_date >= CURRENT_DATE
  ORDER BY snapshot_date DESC;
  ```
- [ ] Verify vehicles found: _____
- [ ] Check for errors in scraping_logs
- [ ] Action needed: ⬜ None | 🟡 Investigate | ❌ Fix required

### Day 3-7 (Monitor Daily):
- [ ] Day 3: Cron ran ✅ | Vehicles: _____ | Status: _____
- [ ] Day 4: Cron ran ✅ | Vehicles: _____ | Status: _____
- [ ] Day 5: Cron ran ✅ | Vehicles: _____ | Status: _____
- [ ] Day 6: Cron ran ✅ | Vehicles: _____ | Status: _____
- [ ] Day 7: Cron ran ✅ | Vehicles: _____ | Status: _____

### After 1 Week:
- [ ] All scraping runs successful
- [ ] Vehicles being tracked correctly
- [ ] Price changes detected (if any)
- [ ] No major errors in logs
- [ ] Ready to add more dealers

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Issues Found

---

## 🎯 **STEP 9: ADD MORE DEALERS** (As needed)

For each new dealer:
- [ ] Ensure tenant has `website_url` set in database
- [ ] Trigger manual scrape for that tenant:
  ```bash
  curl -X POST \
    'https://ueoovsjhaxykewtsnbqx.supabase.co/functions/v1/scrape-dealer-inventory' \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"tenant_id": "TENANT_UUID_HERE"}'
  ```
- [ ] Verify data extracted correctly
- [ ] Customize parser if needed
- [ ] Add to daily cron (automatic)

**Dealers Added:**
1. [ ] Dealer 1: _________________ | Status: _______
2. [ ] Dealer 2: _________________ | Status: _______
3. [ ] Dealer 3: _________________ | Status: _______

---

## 🔍 **TROUBLESHOOTING CHECKLIST**

### If No Vehicles Found:
- [ ] Check website is accessible (not blocking bots)
- [ ] Inspect HTML structure manually
- [ ] Verify parser matches HTML patterns
- [ ] Check scraping_logs for specific errors
- [ ] Try customizing parser

### If Function Times Out:
- [ ] Check website response time
- [ ] Reduce number of tenants per run
- [ ] Split into multiple cron jobs
- [ ] Check for infinite loops in parser

### If Cron Not Running:
- [ ] Verify pg_cron extension enabled
- [ ] Check cron job exists: `SELECT * FROM cron.job;`
- [ ] Check service role key is correct
- [ ] View cron logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`

### If Duplicate Sales Records:
- [ ] Check VIN extraction working correctly
- [ ] Verify unique constraint on sales_records
- [ ] Review trigger logic

---

## 📈 **SUCCESS METRICS**

After 1 Week:
- [ ] 7/7 successful scraping runs
- [ ] Average vehicles per run: _____
- [ ] Total vehicles tracked: _____
- [ ] Vehicles marked as sold: _____
- [ ] Sales records created: _____
- [ ] Average scraping duration: _____ ms

After 1 Month:
- [ ] 30/30 successful scraping runs
- [ ] Built meaningful sales history
- [ ] Price trends visible
- [ ] VIN decoder confidence improved
- [ ] Zero intervention required

---

## 🎓 **KNOWLEDGE CHECK**

Before marking complete, ensure you understand:

- [ ] How the scraping function works
- [ ] How to read inventory_snapshots data
- [ ] How vehicle_history tracks changes
- [ ] How sold vehicles are detected
- [ ] How to troubleshoot common issues
- [ ] How to customize the parser
- [ ] How to monitor scraping health
- [ ] Where to find logs and errors

---

## ✨ **DEPLOYMENT COMPLETE!**

When all steps are ✅:

- [ ] System is scraping automatically daily
- [ ] Data is being tracked correctly
- [ ] Sales history is building
- [ ] VIN decoder will improve over time
- [ ] No manual intervention needed

**Deployment Date:** _______________
**Deployed By:** _______________
**Notes:** _______________

---

## 📞 **NEXT STEPS**

- [ ] Review data after 1 week
- [ ] Add admin dashboard (optional)
- [ ] Set up email alerts (optional)
- [ ] Expand to more dealers
- [ ] Integrate with VIN recommendations

**Congratulations! 🎉 Website scraping is live!**
