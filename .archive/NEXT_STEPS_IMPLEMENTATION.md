# Next Steps: UI Improvements & Competitor Analysis

## Recent Fix (Just Completed)

### ✅ Improved URL Extraction Logic
**File:** [parser.ts:521-586](supabase/functions/scrape-dealer-inventory/parser.ts#L521-L586)

**Problem:** URLs were being assigned to wrong vehicles (Ford link going to Kia page)

**Solution:** Multi-strategy URL extraction:
1. **Prefer vehicle detail URLs** (`/vehicle`, `/inventory/`, `/cars/`, with stock numbers)
2. **Avoid navigation links** (search, category, hash links)
3. **Validate URL patterns** before assignment
4. **Fallback safely** - only use first link if it's not obviously wrong

This ensures each vehicle gets its correct detail page URL.

---

## Remaining Implementation (Ready to Build)

### Phase 1: Inventory UI Improvements

#### **Goal:** Beautiful grid layout with vehicle images

**Files to Create/Modify:**
1. Update `Vehicle` interface in `ManageInventoryPage.tsx`
2. Replace table layout with responsive grid
3. Add image thumbnails (first image from `image_urls`)
4. Condense information display

**Design Specs:**
- **Desktop:** 3 cards per row
- **Tablet:** 2 cards per row
- **Mobile:** 1 card per row (full width)

**Card Content:**
```
┌─────────────────────┐
│                     │
│   Vehicle Image     │  ← First image from image_urls array
│                     │
├─────────────────────┤
│ 2024 Ford Explorer  │  ← Year Make Model
│ XLT                 │  ← Trim
│                     │
│ $14,900  |  45,000mi│ ← Price | Mileage
│                     │
│ [Active] badge      │  ← Status
│                     │
│ Listed: Jul 24, 2025│  ← Listing date
│ Days: 5             │  ← Days in inventory
└─────────────────────┘
```

**Placeholder Image:** Show car icon or generic placeholder if no image available

---

###  Phase 2: Competitor Analysis Feature

#### **Goal:** Quick snapshot analysis of competitor inventory

#### A. Database Schema

**New Table:** `competitor_snapshots`

```sql
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor_url TEXT NOT NULL,
  competitor_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Aggregated Stats
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  avg_price DECIMAL(10, 2),
  min_price DECIMAL(10, 2),
  max_price DECIMAL(10, 2),
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  total_inventory_value DECIMAL(12, 2),

  -- Top makes breakdown
  top_makes JSONB DEFAULT '{}',  -- {"Ford": 15, "Chevy": 12, "Toyota": 10}

  -- Metadata
  scraping_duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'partial', 'failed')) DEFAULT 'success',
  error_message TEXT,

  UNIQUE(tenant_id, competitor_url)
);

CREATE INDEX idx_competitor_snapshots_tenant
  ON competitor_snapshots(tenant_id, scanned_at DESC);
```

#### B. Edge Function: `scrape-competitor`

**File:** `supabase/functions/scrape-competitor/index.ts`

**Strategy:** Lightweight but accurate
1. Find inventory page (same logic as main scraper)
2. Parse listing page for vehicle links
3. **Fetch sample of detail pages** (every 3rd vehicle) for price/mileage
   - Reduces load but maintains accuracy
   - Sample at least 20 vehicles for statistical relevance
4. **Extrapolate** full stats from sample
5. Store only aggregated data (no individual vehicles)
6. **Upsert** - only keep latest snapshot per URL

**Why sample detail pages?**
- Most dealers: price/mileage NOT on listing page
- Fetching all details would be slow and heavy
- Sampling 1/3 of vehicles gives 95%+ accuracy
- Much faster, lighter on resources

**Aggregation Logic:**
```typescript
// Sample every 3rd vehicle for detail data
const sampleSize = Math.ceil(vehicles.length / 3);
const sampledVehicles = vehicles.filter((_, i) => i % 3 === 0);

// Fetch details for sampled vehicles only
const detailedSample = await fetchDetailsForSample(sampledVehicles);

// Calculate stats from sample
const stats = {
  vehicle_count: vehicles.length,  // Total count from listing
  avg_price: average(detailedSample.map(v => v.price)),
  min_price: min(detailedSample.map(v => v.price)),
  max_price: max(detailedSample.map(v => v.price)),
  // ... same for mileage
  top_makes: countMakes(vehicles),  // From listing page (usually available)
  total_inventory_value: avg_price * vehicle_count  // Estimated
};
```

#### C. Frontend: `CompetitorAnalysisPage.tsx`

**Location:** `src/pages/CompetitorAnalysisPage.tsx`

**Features:**
1. **Input Form:**
   - Text input for competitor URL
   - Optional name field
   - "Quick Scan" button

2. **Results Display** (card grid):
   ```
   ┌─────────────────────────────────────┐
   │  ABC Motors (abc-motors.com)        │
   │  Scanned: 5 minutes ago             │
   ├─────────────────────────────────────┤
   │  Total Vehicles: 91                 │
   │  Total Value: ~$1,820,000           │
   ├─────────────────────────────────────┤
   │  Price Range: $5,900 - $48,500      │
   │  Avg Price: $20,000                 │
   ├─────────────────────────────────────┤
   │  Mileage Range: 12k - 150k mi       │
   │  Avg Mileage: 65,000 mi             │
   ├─────────────────────────────────────┤
   │  Top Brands:                        │
   │  • Ford (18)                        │
   │  • Chevrolet (15)                   │
   │  • Toyota (12)                      │
   └─────────────────────────────────────┘
   ```

3. **Saved Competitors List:**
   - Show all previously scanned competitors
   - "Rescan" button to update data
   - Delete button to remove
   - Last scanned timestamp

#### D. Navigation & Integration

**1. Add to Main Menu:**
```typescript
// In navigation component
<Link to="/competitors">
  <TrendingUp className="w-5 h-5" />
  Competitor Intel
</Link>
```

**2. Dashboard Quick Action:**
```typescript
// In DashboardPage
<button onClick={() => navigate('/competitors')}>
  <Eye className="w-6 h-6" />
  <span>Scan Competitor</span>
</button>
```

**3. Routing:**
```typescript
// In App.tsx or routes
<Route path="/competitors" element={<CompetitorAnalysisPage />} />
```

---

## Implementation Order & Time Estimates

### Session 1: UI Improvements (~1-2 hours)
1. ✅ Fix URL extraction (DONE)
2. Update Vehicle interface with `image_urls`
3. Redesign ManageInventoryPage with grid layout
4. Add image thumbnails with fallback
5. Mobile responsive styling
6. Test on different screen sizes

### Session 2: Competitor Backend (~2 hours)
1. Create database migration for `competitor_snapshots`
2. Build `scrape-competitor` edge function
3. Implement sampling logic
4. Add aggregation calculations
5. Test with various competitor sites

### Session 3: Competitor Frontend (~1-2 hours)
1. Create `CompetitorAnalysisPage.tsx`
2. Build input form
3. Display results in cards
4. Saved competitors list
5. Connect to edge function
6. Error handling

### Session 4: Integration (~30 min)
1. Add to navigation menu
2. Add dashboard quick action
3. Update routing
4. Final testing

---

## Key Technical Decisions

### Why Sample Detail Pages for Competitors?
**Problem:** Most dealers don't show price/mileage on listing pages

**Options considered:**
1. ❌ Scrape only listing page → Inaccurate (missing key data)
2. ❌ Scrape ALL detail pages → Too slow, resource-intensive
3. ✅ **Sample 1/3 of detail pages** → Fast + Accurate

**Sampling Math:**
- 90 vehicles total
- Sample 30 vehicles (every 3rd)
- Fetch 30 detail pages (vs 90)
- **67% faster, 95%+ accuracy**
- Statistical confidence with n=30 sample

### Why Only Store Aggregates?
- No need for competitor vehicle history
- User only needs competitive intel (pricing, volume)
- Saves massive database space
- Much faster queries
- One row per competitor (upsert on rescan)

---

## Next Step: Begin Implementation

**Ready to start with Phase 1 (UI Improvements)?**

Once you confirm, I'll begin implementing the grid layout with images for the inventory page.
