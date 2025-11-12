# Website Scraping Implementation Plan

## 🎯 **Objective**
Automatically scrape dealer websites daily to:
1. Track which vehicles are listed (inventory)
2. Monitor price changes over time
3. Detect when vehicles are sold (disappear from listings)
4. Build dealer-specific sales history for AI recommendations

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                    SCRAPING PIPELINE                        │
└─────────────────────────────────────────────────────────────┘

1. TRIGGER (Daily Cron Job)
   ↓
2. SUPABASE EDGE FUNCTION (or Serverless API)
   ↓
3. FETCH DEALER WEBSITE HTML
   ↓
4. PARSE INVENTORY LISTINGS
   ↓
5. EXTRACT DATA (VIN, make, model, price, images)
   ↓
6. COMPARE WITH YESTERDAY'S DATA
   ↓
7. UPDATE DATABASE
   - New vehicles → INSERT
   - Price changes → UPDATE
   - Missing vehicles → Mark as SOLD
   ↓
8. GENERATE SALES RECORDS
```

---

## 🛠️ **Technology Stack**

### **Option 1: Supabase Edge Functions (Recommended)**
✅ **Pros:**
- Integrated with your existing Supabase setup
- Built-in authentication
- TypeScript/Deno runtime
- Free tier: 500K executions/month
- Easy scheduling with pg_cron

❌ **Cons:**
- 50-second timeout limit
- Limited to Deno runtime (not full Node.js)
- Memory constraints for large scraping jobs

**Cost:** Free for most use cases

---

### **Option 2: Vercel Serverless Functions**
✅ **Pros:**
- Longer timeout (60 seconds hobby, 300 seconds pro)
- Full Node.js support
- Easy deployment
- Built-in cron via `vercel.json`

❌ **Cons:**
- Separate infrastructure from Supabase
- Need to secure API routes
- Hobby plan limited

**Cost:** Free (Hobby) or $20/month (Pro)

---

### **Option 3: Render Background Workers**
✅ **Pros:**
- No timeout limits
- Can run long scraping jobs
- True cron scheduling
- Persistent processes

❌ **Cons:**
- Most expensive option
- Overkill for daily scraping

**Cost:** $7/month minimum

---

## 📋 **Recommended Implementation: Supabase Edge Functions**

### **File Structure:**
```
supabase/
  functions/
    scrape-dealer-inventory/
      index.ts           # Main scraping logic
      parsers.ts         # HTML parsing utilities
      types.ts           # TypeScript types
```

### **Database Tables Needed:**

```sql
-- Store raw inventory snapshots
CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  snapshot_date TIMESTAMP DEFAULT NOW(),
  vehicles_found INTEGER,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track vehicle history (price changes, days listed)
CREATE TABLE vehicle_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  vin TEXT,
  price NUMERIC,
  mileage INTEGER,
  listing_url TEXT,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  status TEXT, -- 'active', 'sold', 'price_changed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable row-level security
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_history ENABLE ROW LEVEL SECURITY;
```

---

## 🔄 **Scraping Workflow**

### **Step 1: Daily Cron Trigger**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily scraping at 2 AM
SELECT cron.schedule(
  'daily-dealer-scraping',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scrape-dealer-inventory',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### **Step 2: Edge Function Scrapes Website**

```typescript
// supabase/functions/scrape-dealer-inventory/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active tenants with websites
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name, website_url')
      .not('website_url', 'is', null)
      .eq('status', 'active');

    const results = [];

    for (const tenant of tenants || []) {
      console.log(`Scraping ${tenant.name}...`);

      // Fetch dealer website
      const response = await fetch(tenant.website_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Dealer-Copilot-Bot/1.0)',
        },
      });

      const html = await response.text();

      // Parse inventory listings
      const vehicles = parseInventoryListings(html);

      // Save snapshot
      await supabase.from('inventory_snapshots').insert({
        tenant_id: tenant.id,
        vehicles_found: vehicles.length,
        raw_data: vehicles,
      });

      // Update vehicle_history table
      for (const vehicle of vehicles) {
        await processVehicle(supabase, tenant.id, vehicle);
      }

      results.push({
        tenant: tenant.name,
        vehicles_found: vehicles.length,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function parseInventoryListings(html: string) {
  // TODO: Implement parsing logic
  // This will vary by dealer website platform:
  // - WordPress plugins (WP Inventory Manager, etc.)
  // - Dealer management systems (vAuto, DealerSocket, etc.)
  // - Custom HTML structures

  // For now, return empty array
  return [];
}

async function processVehicle(supabase, tenant_id, vehicle) {
  // Check if vehicle exists in history
  const { data: existing } = await supabase
    .from('vehicle_history')
    .select('*')
    .eq('vin', vehicle.vin)
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!existing) {
    // New vehicle - insert
    await supabase.from('vehicle_history').insert({
      tenant_id,
      vin: vehicle.vin,
      price: vehicle.price,
      mileage: vehicle.mileage,
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      status: 'active',
    });
  } else {
    // Existing vehicle - check for changes
    if (existing.price !== vehicle.price) {
      // Price changed
      await supabase.from('vehicle_history').insert({
        tenant_id,
        vehicle_id: existing.vehicle_id,
        vin: vehicle.vin,
        price: vehicle.price,
        mileage: vehicle.mileage,
        last_seen_at: new Date(),
        status: 'price_changed',
      });
    } else {
      // Just update last_seen
      await supabase
        .from('vehicle_history')
        .update({ last_seen_at: new Date() })
        .eq('id', existing.id);
    }
  }
}
```

### **Step 3: Detect Sold Vehicles**

```typescript
// Run separate function to find vehicles that disappeared
async function detectSoldVehicles(supabase, tenant_id) {
  // Find vehicles that haven't been seen in 2+ days
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: missingSql } = await supabase
    .from('vehicle_history')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('status', 'active')
    .lt('last_seen_at', twoDaysAgo.toISOString());

  for (const vehicle of missing || []) {
    // Mark as sold
    await supabase
      .from('vehicle_history')
      .update({ status: 'sold' })
      .eq('id', vehicle.id);

    // Create sales record
    const daysListed = Math.floor(
      (new Date() - new Date(vehicle.first_seen_at)) / (1000 * 60 * 60 * 24)
    );

    await supabase.from('sales_records').insert({
      tenant_id,
      vin: vehicle.vin,
      sale_price: vehicle.price, // Last known listing price
      days_to_sale: daysListed,
      sale_date: new Date(),
    });
  }
}
```

---

## 🚀 **Deployment Steps**

### **1. Install Supabase CLI**
```bash
npm install -g supabase
supabase login
```

### **2. Initialize Functions**
```bash
cd /Users/gustavocamilo/Documents/GitHub/dealer-copilot
supabase functions new scrape-dealer-inventory
```

### **3. Deploy Function**
```bash
supabase functions deploy scrape-dealer-inventory --project-ref ueoovsjhaxykewtsnbqx
```

### **4. Set Up Secrets**
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **5. Enable Cron**
Run the SQL cron schedule in Supabase SQL Editor

---

## 🎨 **HTML Parsing Strategy**

Most dealer websites use common patterns:

### **Common Platforms:**

1. **WordPress + Inventory Plugin**
   - Look for `.inventory-item`, `.vehicle-card`, etc.
   - Usually has structured data in data attributes

2. **vAuto/DealerSocket**
   - Often use iframes or API endpoints
   - May require reverse engineering their API

3. **Custom HTML**
   - Inspect page structure
   - Find repeating patterns
   - Extract with CSS selectors

### **Example Parser:**

```typescript
function parseWordPressInventory(html: string) {
  // Simple regex-based extraction (works for basic sites)
  const vehiclePattern = /<div class="vehicle-item"[^>]*>(.*?)<\/div>/gs;
  const matches = [...html.matchAll(vehiclePattern)];

  return matches.map(match => {
    const itemHtml = match[1];

    // Extract data
    const vin = itemHtml.match(/data-vin="([^"]+)"/)?.[1];
    const price = itemHtml.match(/\$([0-9,]+)/)?.[1]?.replace(/,/g, '');
    const year = itemHtml.match(/(\d{4})\s+([\w\s]+)/)?.[1];
    const makeModel = itemHtml.match(/\d{4}\s+([\w\s]+)/)?.[1];

    return {
      vin,
      price: parseFloat(price || '0'),
      year: parseInt(year || '0'),
      make: makeModel?.split(' ')[0],
      model: makeModel?.split(' ').slice(1).join(' '),
    };
  }).filter(v => v.vin); // Only keep vehicles with VIN
}
```

---

## 📊 **Building Sales History**

Once scraping is running, the system automatically:

1. **Tracks listing duration** → `first_seen_at` to `last_seen_at`
2. **Detects price drops** → `price_changed` events
3. **Marks as sold** → When vehicle disappears for 2+ days
4. **Creates sales records** → With `days_to_sale` calculated

### **Sales Record Example:**
```json
{
  "tenant_id": "uuid",
  "vin": "1HGCV1F30LA012345",
  "year": 2020,
  "make": "Honda",
  "model": "Accord",
  "sale_price": 23995,
  "acquisition_cost": null, // Unknown from scraping
  "days_to_sale": 18,
  "sale_date": "2025-11-12"
}
```

---

## ⚡ **Quick Start (MVP)**

### **Phase 1: Manual Testing (This Week)**
1. Create Edge Function
2. Manually trigger via API call
3. Test with 1-2 dealer websites
4. Verify data extraction

### **Phase 2: Automated Daily (Next Week)**
1. Set up cron schedule
2. Add error handling and logging
3. Build admin dashboard to view scraping results
4. Add email alerts for failures

### **Phase 3: Scale (Future)**
1. Support multiple dealer website platforms
2. Add retry logic and rate limiting
3. Parallel scraping for multiple dealers
4. Real-time webhook notifications

---

## 💰 **Cost Estimate**

**Supabase Edge Functions:**
- 500K executions/month FREE
- You need: ~30 executions/month (1 per day per tenant)
- **Cost: $0**

**Database Storage:**
- ~1 KB per vehicle snapshot
- ~50 vehicles × 30 days = 1,500 records/month
- ~1.5 MB/month
- **Cost: Included in free tier**

**Total Monthly Cost: $0** 🎉

---

## 🔒 **Security Considerations**

1. **Rate Limiting** - Don't hammer dealer websites
2. **User Agent** - Identify your bot properly
3. **Robots.txt** - Respect website policies
4. **GDPR/Privacy** - Only scrape public data
5. **Service Role Key** - Never expose in frontend

---

## 📝 **Next Steps**

Want me to:
1. ✅ **Create the Edge Function code** (scraping boilerplate)?
2. ✅ **Generate SQL migrations** for vehicle_history tables?
3. ✅ **Build admin page** to view scraping results?
4. ✅ **Create parser for specific dealer platform** (tell me which one)?

Let me know which you want first! 🚀
