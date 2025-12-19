# Dealer Copilot - System Architecture

## Overview

Dealer Copilot is a multi-tenant SaaS platform that provides inventory management and competitive intelligence for automotive dealers. The system follows a unified data architecture where dealer and competitor data are stored in the same tables, differentiated by the `tenant_id` and `source_type` fields.

## Core Design Principles

### 1. Unified Data Model
- **One table for all vehicles**: `tracked_vehicles` stores both dealer inventory and competitor vehicles
- **One table for all snapshots**: `inventory_snapshots_unified` stores aggregated stats for both dealers and competitors
- **One table for all sources**: `source_registry` manages scraping sources for dealers and competitors

### 2. Multi-Tenancy via NULL Pattern
- **Dealer data**: `tenant_id NOT NULL` - Data belongs to a specific tenant
- **Competitor data**: `tenant_id IS NULL` - Data is globally shared across all tenants

### 3. Row-Level Security (RLS)
- Tenants can view their own data (tenant_id matches)
- ALL authenticated users can view competitor data (source_type = 'competitor')
- Super admins can view everything

---

## Database Schema

### Core Tables

#### 1. `tracked_vehicles`
**Purpose**: Unified vehicle tracking for dealer inventory and competitor vehicles

**Key Fields**:
```sql
CREATE TABLE tracked_vehicles (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),  -- NULL for competitors
  source_url TEXT NOT NULL,                -- Domain/URL identifier
  source_type TEXT NOT NULL,               -- 'dealer' or 'competitor'
  vin TEXT NOT NULL,
  year INTEGER,
  make TEXT,
  model TEXT,
  price DECIMAL,
  mileage INTEGER,
  listing_url TEXT,
  image_url TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  status TEXT,                             -- 'active', 'sold', 'removed'
  listing_date_confidence TEXT,            -- 'high', 'medium', 'low', 'estimated'

  -- Unique constraint for dealer vehicles
  CONSTRAINT unique_dealer_vehicle
    UNIQUE NULLS NOT DISTINCT (tenant_id, source_url, vin),

  -- Separate unique constraint for competitor vehicles
  CONSTRAINT unique_competitor_vehicle
    UNIQUE (source_url, vin) WHERE tenant_id IS NULL
);
```

**Data Patterns**:
- **Dealer Vehicle**: `tenant_id = <uuid>`, `source_type = 'dealer'`
  - Visible only to that tenant
  - VIN uniqueness per tenant+source
- **Competitor Vehicle**: `tenant_id = NULL`, `source_type = 'competitor'`
  - Visible to ALL tenants
  - VIN uniqueness per source globally

**Indexes**:
```sql
CREATE INDEX idx_tracked_vehicles_active_dealer
  ON tracked_vehicles (tenant_id, source_url, status)
  WHERE status = 'active' AND source_type = 'dealer';

CREATE INDEX idx_tracked_vehicles_active_competitor
  ON tracked_vehicles (source_url, status)
  WHERE status = 'active' AND source_type = 'competitor' AND tenant_id IS NULL;
```

---

#### 2. `inventory_snapshots_unified`
**Purpose**: Daily aggregated statistics for dealer inventory and competitor data

**Key Fields**:
```sql
CREATE TABLE inventory_snapshots_unified (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),  -- NULL for competitors
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,               -- 'dealer' or 'competitor'
  source_name TEXT,
  snapshot_date DATE NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL,
  vehicle_count INTEGER,
  avg_price DECIMAL,
  min_price DECIMAL,
  max_price DECIMAL,
  avg_mileage INTEGER,
  min_mileage INTEGER,
  max_mileage INTEGER,
  total_inventory_value DECIMAL,
  make_distribution JSONB,                 -- {"Ford": 25, "Chevrolet": 18, ...}
  status TEXT,                             -- 'success', 'partial', 'failed', 'pending'

  -- Unique constraint for dealer snapshots (one per tenant per day)
  UNIQUE (tenant_id, snapshot_date) WHERE tenant_id IS NOT NULL,

  -- Unique constraint for competitor snapshots (one per source per day)
  UNIQUE (source_url, snapshot_date) WHERE tenant_id IS NULL
);
```

**Data Patterns**:
- **Dealer Snapshot**: `tenant_id = <uuid>`, `source_type = 'dealer'`
  - One snapshot per tenant per day
- **Competitor Snapshot**: `tenant_id = NULL`, `source_type = 'competitor'`
  - One snapshot per competitor source per day
  - Visible to ALL tenants

**Make Distribution Format**:
```json
{
  "Ford": 45,
  "Chevrolet": 32,
  "Toyota": 28,
  "Honda": 15
}
```

---

#### 3. `source_registry`
**Purpose**: Unified registry of all scraping sources (dealers and competitors)

**Key Fields**:
```sql
CREATE TABLE source_registry (
  id UUID PRIMARY KEY,
  source_url TEXT UNIQUE NOT NULL,         -- Normalized domain (e.g., 'example.com')
  source_type TEXT NOT NULL,               -- 'dealer' or 'competitor'
  source_name TEXT,                        -- Friendly display name
  tenant_id UUID REFERENCES tenants(id),   -- NULL for competitors
  scraping_enabled BOOLEAN DEFAULT TRUE,
  last_scraped_at TIMESTAMPTZ,
  next_scheduled_scrape TIMESTAMPTZ,
  scraping_frequency_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Data Patterns**:
- **Dealer Source**: `tenant_id = <uuid>`, `source_type = 'dealer'`
  - Owned by specific tenant
- **Competitor Source**: `tenant_id = NULL`, `source_type = 'competitor'`
  - Global, can be requested by any tenant

**URL Normalization**:
- Full URL: `https://www.example.com/inventory/` → Normalized: `example.com`
- Protocol and www prefix removed
- Path removed, only domain kept

---

#### 4. `manual_scraping_uploads`
**Purpose**: Audit log of manual CSV uploads

**Key Fields**:
```sql
CREATE TABLE manual_scraping_uploads (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),  -- Who requested/uploaded
  uploaded_by UUID NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  status TEXT,                              -- 'processing', 'completed', 'failed'
  vehicles_processed INTEGER,
  vehicles_new INTEGER,
  vehicles_updated INTEGER,
  vehicles_sold INTEGER,
  error_log JSONB,
  raw_csv_data TEXT,
  scraping_source TEXT,                     -- 'dealer_inventory' or 'competitor_data'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**: Even competitor uploads have a `tenant_id` here for audit purposes (who requested the scrape), but the actual competitor data in `tracked_vehicles` has `tenant_id = NULL`.

---

## Data Flow

### Dealer Inventory Upload

```
1. CSV Upload → upload-universal-csv function
   ↓
2. Extract domain from CSV (Dealership_URL column)
   ↓
3. Find/Create source in source_registry
   - source_type = 'dealer'
   - tenant_id = <tenant_uuid>
   ↓
4. Upsert vehicles into tracked_vehicles
   - tenant_id = <tenant_uuid>
   - source_type = 'dealer'
   - UNIQUE (tenant_id, source_url, vin)
   ↓
5. Calculate aggregate statistics
   ↓
6. Upsert into inventory_snapshots_unified
   - tenant_id = <tenant_uuid>
   - source_type = 'dealer'
   - UNIQUE (tenant_id, snapshot_date)
   ↓
7. Log in manual_scraping_uploads
   - status = 'completed'
   ↓
8. Update tenants.inventory_status = 'ready'
```

---

### Competitor Data Upload

```
1. CSV Upload → upload-universal-csv function
   ↓
2. Extract domain from CSV (URL column)
   ↓
3. Find/Create source in source_registry
   - source_type = 'competitor'
   - tenant_id = NULL (global)
   ↓
4. Upsert vehicles into tracked_vehicles
   - tenant_id = NULL (global)
   - source_type = 'competitor'
   - UNIQUE (source_url, vin) WHERE tenant_id IS NULL
   ↓
5. Calculate aggregate statistics
   ↓
6. Upsert into inventory_snapshots_unified
   - tenant_id = NULL (global)
   - source_type = 'competitor'
   - UNIQUE (source_url, snapshot_date) WHERE tenant_id IS NULL
   ↓
7. Log in manual_scraping_uploads
   - tenant_id = <requesting_tenant_uuid> (for audit)
   - status = 'completed'
   ↓
8. Update source_registry.last_scraped_at
```

---

## Row-Level Security (RLS) Policies

### tracked_vehicles

```sql
-- Dealers can view their own vehicles
CREATE POLICY "Dealers can view own vehicles"
  ON tracked_vehicles FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Anyone can view competitor vehicles
CREATE POLICY "Anyone can view competitor vehicles"
  ON tracked_vehicles FOR SELECT
  USING (source_type = 'competitor' AND tenant_id IS NULL);

-- Super admins can view all
CREATE POLICY "Super admins can view all vehicles"
  ON tracked_vehicles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  ));
```

### inventory_snapshots_unified

```sql
-- Dealers can view own snapshots
CREATE POLICY "Dealers can view own snapshots"
  ON inventory_snapshots_unified FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Anyone can view competitor snapshots
CREATE POLICY "Anyone can view competitor snapshots"
  ON inventory_snapshots_unified FOR SELECT
  USING (source_type = 'competitor');

-- Super admins can view all
CREATE POLICY "Super admins can view all snapshots"
  ON inventory_snapshots_unified FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  ));
```

---

## API Functions

### 1. upload-universal-csv
**Path**: `/functions/v1/upload-universal-csv`
**Purpose**: Unified CSV upload handler for both dealer inventory and competitor data

**Request**:
```json
{
  "csv_content": "...",
  "filename": "inventory.csv",
  "upload_type": "dealer_inventory" | "competitor_data"
}
```

**Response**:
```json
{
  "success": true,
  "vehicles_processed": 150,
  "vehicles_new": 12,
  "vehicles_updated": 135,
  "vehicles_sold": 3,
  "snapshot_created": true
}
```

**Authorization**: `super_admin`, `va_uploader`

---

### 2. scrape-competitor
**Path**: `/functions/v1/scrape-competitor`
**Purpose**: Web scraping for competitor websites

**Request**:
```json
{
  "competitor_url": "https://competitor-dealer.com"
}
```

**Response**:
```json
{
  "success": true,
  "vehicles_found": 42,
  "snapshot_created": true,
  "competitor_url": "competitor-dealer.com"
}
```

**Authorization**: `super_admin`, `va_uploader`

---

### 3. manage-scraping-queue
**Path**: `/functions/v1/manage-scraping-queue`
**Purpose**: Manage scraping queue operations

**Supported Actions**:
- `update_status`: Change status in source_registry
- `assign`: Assign task to a user
- `delete`: Hard delete from queue
- `update_priority`: Update priority value

**Authorization**: `super_admin`, `va_uploader`

---

## Frontend Pages

### CompetitorAnalysisPage.tsx
**Path**: `/competitor-intelligence`
**Purpose**: Display competitor analysis data to tenants

**Data Query**:
```typescript
// Get all competitor sources
const { data: sources } = await supabase
  .from('source_registry')
  .select('source_url, source_name')
  .eq('source_type', 'competitor');

// Get latest snapshots for competitors
const { data: snapshots } = await supabase
  .from('inventory_snapshots_unified')
  .select('*')
  .eq('source_type', 'competitor')
  .in('source_url', sourceUrls)
  .order('scanned_at', { ascending: false });

// Group by source_url, keep latest only
const latest = groupBySourceUrl(snapshots);
```

**Display**:
- Vehicle count
- Average/min/max price
- Average/min/max mileage
- Top makes (pie chart from `make_distribution`)
- Scan timestamp

---

## Migration History

### Phase 1: Legacy Architecture (Deprecated)
- `vehicles` table (dealer-only)
- `competitor_vehicles` table (separate table)
- `inventory_snapshots` table (dealer-only)
- `competitor_snapshots` table (separate table)
- `scraping_waiting_list` table (dealer queue)
- `competitor_scraping_waiting_list` table (competitor queue)

### Phase 2: Unified Architecture (Current)
- `tracked_vehicles` (unified, tenant_id NULL pattern)
- `inventory_snapshots_unified` (unified, tenant_id NULL pattern)
- `source_registry` (unified source management)

### Migration 20251126000001
- Created unified tables
- Migrated data from legacy tables
- Added RLS policies

### Migration 20251128000001
- Fixed competitor visibility RLS policies
- Changed from `tenant_id IS NULL` check to `source_type = 'competitor'` check

### Migration 20251219000001
- Migrated remaining data from `competitor_vehicles` to `tracked_vehicles`
- Created snapshots in `inventory_snapshots_unified`

### Migration 20251219000002
- Dropped ALL legacy tables
- Added comprehensive table comments
- Removed legacy views and functions

---

## Best Practices

### 1. Querying Dealer Data
```typescript
// Always filter by tenant_id for dealer data
const { data } = await supabase
  .from('tracked_vehicles')
  .select('*')
  .eq('tenant_id', user.tenant_id)
  .eq('source_type', 'dealer')
  .eq('status', 'active');
```

### 2. Querying Competitor Data
```typescript
// Use source_type filter, tenant_id is NULL
const { data } = await supabase
  .from('tracked_vehicles')
  .select('*')
  .eq('source_type', 'competitor')
  .eq('status', 'active');
```

### 3. Creating Snapshots
```typescript
// For dealers
await supabase
  .from('inventory_snapshots_unified')
  .upsert({
    tenant_id: tenantId,
    source_type: 'dealer',
    snapshot_date: today,
    // ... stats
  }, {
    onConflict: 'tenant_id,snapshot_date'
  });

// For competitors
await supabase
  .from('inventory_snapshots_unified')
  .upsert({
    tenant_id: null,
    source_url: competitorUrl,
    source_type: 'competitor',
    snapshot_date: today,
    // ... stats
  }, {
    onConflict: 'source_url,snapshot_date'
  });
```

### 4. Marking Vehicles as Sold
```typescript
// Find vehicles not in current CSV
const soldVehicles = existingVehicles.filter(v =>
  !csvVINs.has(v.vin)
);

// Mark as sold
await supabase
  .from('tracked_vehicles')
  .update({
    status: 'sold',
    last_seen_at: new Date().toISOString()
  })
  .in('id', soldVehicles.map(v => v.id));
```

---

## Troubleshooting

### Issue: Tenant Cannot See Competitor Data

**Symptoms**: Competitor data uploaded successfully, shows in admin panel, but tenant panel shows no data.

**Diagnosis**:
1. Check if snapshot exists:
   ```sql
   SELECT * FROM inventory_snapshots_unified
   WHERE source_type = 'competitor'
   AND source_url = '<competitor-url>';
   ```

2. Check if vehicles exist:
   ```sql
   SELECT COUNT(*) FROM tracked_vehicles
   WHERE source_type = 'competitor'
   AND source_url = '<competitor-url>'
   AND tenant_id IS NULL;
   ```

3. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'inventory_snapshots_unified';
   ```

**Solution**:
- If no snapshot: Run migration `20251219000001_migrate_legacy_competitor_data.sql`
- If RLS issue: Run migration `20251128000001_fix_competitor_visibility.sql`
- If data in wrong table: Data is in `competitor_vehicles` (legacy) - run migration to move it

---

### Issue: Upload Function Returns Error

**Common Errors**:

1. **"Missing required fields"**
   - Ensure CSV has either `URL` or `Dealership_URL` column
   - Check CSV format is valid (comma-separated, quoted strings if needed)

2. **"Insufficient permissions"**
   - User must have role `super_admin` or `va_uploader`
   - Check `users.role` column

3. **"Failed to create snapshot"**
   - Check unique constraint: `(source_url, snapshot_date)` for competitors
   - Check unique constraint: `(tenant_id, snapshot_date)` for dealers

---

## Security Considerations

### 1. Competitor Data Isolation
- Competitor vehicles have `tenant_id = NULL`
- Ensures NO tenant can modify competitor data
- All tenants see the SAME competitor data (single source of truth)

### 2. Dealer Data Isolation
- Dealer vehicles have `tenant_id = <uuid>`
- RLS policies enforce tenant cannot see other tenant's data
- Unique constraint includes `tenant_id` to prevent cross-tenant VIN conflicts

### 3. Upload Authorization
- Only `super_admin` and `va_uploader` roles can upload data
- `va_uploader` typically assigned to Virtual Assistants
- Audit trail via `manual_scraping_uploads.uploaded_by`

### 4. API Access
- All functions require authentication
- Supabase client uses Authorization header with JWT
- Functions verify user role before processing

---

## Performance Optimization

### 1. Indexes
All critical query paths are indexed:
- `tracked_vehicles` has indexes on `(tenant_id, source_url, status)`
- `inventory_snapshots_unified` has indexes on `(tenant_id, snapshot_date)` and `(source_url, snapshot_date)`

### 2. Snapshot Strategy
- One snapshot per source per day
- Upsert on conflict to update existing snapshot
- Reduces data duplication

### 3. Sold Vehicle Cleanup
- Vehicles not in CSV marked as `status='sold'`
- Excludes sold vehicles from active inventory queries
- Historical record preserved for analytics

---

## Future Enhancements

### Potential Improvements
1. **Automated Scraping**: Schedule automatic scraping for competitors
2. **Price History Tracking**: Track price changes over time in separate table
3. **Inventory Alerts**: Notify when competitor inventory drops significantly
4. **Make/Model Analysis**: Deeper analysis of which makes/models competitors focus on
5. **Geographic Analysis**: Track competitor locations and coverage areas

---

## Support

For issues or questions about the architecture:
1. Check this document first
2. Review migration files in `/supabase/migrations/`
3. Check RLS policies in database
4. Contact: dev team

---

**Last Updated**: 2025-12-19
**Architecture Version**: 2.0 (Unified)
