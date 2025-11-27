# Dealer Co-Pilot System Guidelines

> **Last Updated:** 2025-11-27  
> **Version:** 2.0 - Unified Architecture  
> **Status:** Active Development

---

## 🚀 QUICK START FOR NEW DEVELOPERS/AI

**READ THIS FIRST.** This document is the single source of truth for understanding Dealer Co-Pilot's architecture.

### TL;DR
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Frontend**: React + TypeScript + Tailwind + Vite
- **Architecture**: Unified Inventory System (dealers & competitors in one table)
- **Legacy Code**: Located in `legacy/` and `archive/` folders - **IGNORE THESE**
- **Active Tables**: `tracked_vehicles`, `inventory_snapshots_unified`, `source_registry`

---

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Components](#2-architecture-components)
3. [Edge Functions Reference](#3-edge-functions-reference)
4. [Database Schema](#4-database-schema)
5. [Legacy Components](#5-legacy-components)
6. [Frontend Pages](#6-frontend-pages)
7. [Development Guidelines](#7-development-guidelines)
8. [Common Tasks](#8-common-tasks)
9. [Troubleshooting](#9-troubleshooting)
10. [Roadmap & Priorities](#10-roadmap--priorities)

---

## 1. System Overview

Dealer Co-Pilot is a SaaS platform that helps car dealerships:
- Track their inventory automatically via web scraping
- Monitor competitor pricing and inventory
- Generate AI-powered recommendations for pricing and inventory decisions
- Analyze sales performance and market trends

### Core Philosophy
- **Everything is a Source**: Whether it's a Client Dealership or a Competitor, it is a `Source` in our system.
- **Unified Storage**: All vehicles live in one table (`tracked_vehicles`). All snapshots live in one table (`inventory_snapshots_unified`).
- **Identity via Registry**: The `source_registry` table is the single source of truth for who we are tracking and why.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Scraping | Python (undetected-chromedriver), Playwright |
| Hosting | Vercel (frontend), Supabase (backend), DigitalOcean (scrapers) |

---

## 2. Architecture Components

### 2.1. The Source Registry (`source_registry`)
This is the heart of the system. It replaces ad-hoc lists and separate tables.

| Field | Type | Description |
|-------|------|-------------|
| `source_url` | TEXT | Unique domain (e.g., `nexautoga.com`) |
| `source_type` | ENUM | `'dealer'` (Client) or `'competitor'` (Non-Client) |
| `tenant_id` | UUID | Links to `tenants` if Client, `NULL` if Competitor |
| `source_name` | TEXT | Human-readable name |
| `scraping_enabled` | BOOLEAN | Whether to include in automated scraping |

**Key Feature**: When a Competitor becomes a Client, simply update `source_type` to `'dealer'` and assign `tenant_id`. All history is preserved!

### 2.2. Unified Vehicle Tracking (`tracked_vehicles`)
| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | UUID | NULL for competitors, UUID for dealers |
| `source_url` | TEXT | Domain of the source |
| `source_type` | ENUM | `'dealer'` or `'competitor'` |
| `vin` | TEXT | Vehicle Identification Number |
| `year`, `make`, `model` | TEXT/INT | Vehicle details |
| `price`, `mileage` | NUMERIC/INT | Current values |
| `status` | ENUM | `'active'`, `'sold'`, `'pending'` |
| `first_seen_at` | TIMESTAMP | When vehicle first appeared |
| `last_seen_at` | TIMESTAMP | Last time seen in inventory |
| `price_history` | JSONB | Array of price changes |

**Uniqueness Constraints**:
- Dealer vehicles: `(tenant_id, source_url, vin)`
- Competitor vehicles: `(source_url, vin)` where `tenant_id IS NULL`

### 2.3. Unified Snapshots (`inventory_snapshots_unified`)
Stores aggregated stats for each scrape/upload.

| Field | Type | Description |
|-------|------|-------------|
| `source_url` | TEXT | Domain |
| `source_type` | ENUM | `'dealer'` or `'competitor'` |
| `tenant_id` | UUID | NULL for competitors |
| `snapshot_date` | DATE | Date of snapshot |
| `vehicle_count` | INT | Total vehicles |
| `avg_price`, `min_price`, `max_price` | NUMERIC | Price stats |
| `avg_mileage`, `min_mileage`, `max_mileage` | INT | Mileage stats |
| `make_distribution` | JSONB | Count by make |

---

## 3. Edge Functions Reference

### ✅ ACTIVE Functions

| Function | Purpose | Endpoint |
|----------|---------|----------|
| `upload-universal-csv` | **PRIMARY** - Upload CSV for any source (dealer or competitor) | POST |
| `scrape-dealer-inventory` | Automated scraping of dealer websites | POST |
| `scrape-competitor` | On-demand competitor scanning | POST |
| `get-waiting-list` | Get dealer scraping queue | GET |
| `get-competitor-waiting-list` | Get competitor scraping queue | GET |
| `manage-scraping-queue` | Update queue status/assignments | POST |
| `approve-scraping-results` | Admin approval for scraped data | POST |
| `get-scraping-queue` | Combined queue view | GET |
| `decode-vin` | VIN decoding via NHTSA API | POST |
| `market-search` | Market data lookup | POST |
| `notify-vas-slack` | Slack notifications for VAs | POST |
| `export-tenant-inventory` | Export inventory to CSV | GET |

### 🚫 LEGACY Functions (in `supabase/functions/legacy/`)

| Function | Status | Replacement |
|----------|--------|-------------|
| `upload-manual-scraping` | DEPRECATED | Use `upload-universal-csv` |
| `process-competitor-csv` | DEPRECATED | Use `upload-universal-csv` |

---

## 4. Database Schema

### ✅ ACTIVE Tables (Keep & Use)

| Table | Purpose |
|-------|---------|
| `tenants` | Customer accounts |
| `users` | User accounts (linked to tenants) |
| `tracked_vehicles` | All vehicle data (unified) |
| `inventory_snapshots_unified` | Historical snapshots (unified) |
| `source_registry` | All sources we track |
| `sales_records` | Completed sales |
| `vin_scans` | Manual VIN scan results |
| `manual_scraping_uploads` | Upload audit log |
| `scraping_logs` | Scraping activity log |
| `support_tickets` | Customer support |
| `vehicle_comments` | Notes on vehicles |
| `vehicle_auctions` | Auction tracking |

### ⚠️ LEGACY Tables (Migration In Progress)

| Table | Status | Migrate To |
|-------|--------|-----------|
| `vehicles` | DEPRECATED | `tracked_vehicles` |
| `vehicle_history` | DEPRECATED | `tracked_vehicles` |
| `competitor_vehicles` | DEPRECATED | `tracked_vehicles` |
| `inventory_snapshots` | DEPRECATED | `inventory_snapshots_unified` |
| `competitor_snapshots` | DEPRECATED | `inventory_snapshots_unified` |
| `scraping_waiting_list` | DEPRECATED | `source_registry` |
| `competitor_scraping_waiting_list` | DEPRECATED | `source_registry` |

### Database Audit

To analyze your database state, run the queries in:
```
supabase/DATABASE_AUDIT_QUERIES.sql
```

---

## 5. Legacy Components

### Location of Legacy Code

| Type | Location |
|------|----------|
| Edge Functions | `supabase/functions/legacy/` |
| Migrations | `supabase/migrations/archive/` |
| Old Parsers | `**/parser-old-backup.ts` |

### Why We Keep Legacy Code
- Reference for migration logic
- Rollback capability
- Understanding historical decisions

### DO NOT:
- Import from legacy folders
- Reference legacy tables in new code
- Deploy legacy functions

---

## 6. Frontend Pages

### Page Structure (`src/pages/`)

| Page | Purpose | Status |
|------|---------|--------|
| `DashboardPage.tsx` | Main dashboard with KPIs | ACTIVE |
| `ManageInventoryPage.tsx` | View/manage dealer inventory | ⚠️ NEEDS UPDATE (uses legacy tables) |
| `CompetitorAnalysisPage.tsx` | Competitor insights | ⚠️ NEEDS UPDATE (uses legacy tables) |
| `CompetitorHistoryPage.tsx` | Historical competitor data | ⚠️ NEEDS UPDATE |
| `RecommendationsPage.tsx` | AI recommendations | ACTIVE |
| `VINScanPage.tsx` | Manual VIN lookup | ACTIVE |
| `VINScansPage.tsx` | VIN scan history | ACTIVE |
| `AdminPage.tsx` | Super admin dashboard | ⚠️ NEEDS UPDATE |
| `SettingsPage.tsx` | User/tenant settings | ACTIVE |
| `SignInPage.tsx` / `SignUpPage.tsx` | Auth pages | ACTIVE |
| `OnboardingPage.tsx` | New tenant setup | ⚠️ NEEDS UPDATE |
| `LandingPage.tsx` | Marketing page | ACTIVE |
| `UpgradePage.tsx` | Subscription upgrade | ACTIVE |

### ⚠️ Frontend Migration Needed

The following pages still reference legacy tables and need to be updated:

```
AdminPage.tsx         → uses: inventory_snapshots
OnboardingPage.tsx    → uses: inventory_snapshots, scraping_waiting_list
CompetitorAnalysisPage.tsx → uses: competitor_scraping_waiting_list, competitor_snapshots
ManageInventoryPage.tsx    → uses: vehicle_history, scraping_waiting_list
```

---

## 7. Development Guidelines

### Adding New Features
1. **Do NOT create separate tables** for Dealers vs Competitors
2. **Check `source_registry` first** - Always resolve context using this registry
3. **RLS is King** - Security via Row Level Security, not table separation
4. **Use unified tables** - `tracked_vehicles`, `inventory_snapshots_unified`

### Code Style
- TypeScript strict mode
- Tailwind for styling (no CSS files)
- Supabase client from `src/lib/supabase.ts`
- React hooks for state management

### File Naming
- Components: `PascalCase.tsx`
- Services: `camelCase.ts`
- Types: `camelCase.ts` in `types/` folder

### Testing
- Run edge functions locally: `supabase functions serve`
- Test with: `curl` or Postman
- Check logs: `supabase logs`

---

## 8. Common Tasks

### Adding a New Tenant
1. Create tenant in `tenants` table
2. Source auto-registered on first upload/scrape
3. Or manually add to `source_registry`

### Processing a CSV Upload
1. Call `upload-universal-csv` with CSV content
2. Function auto-detects source from URL column
3. Creates/updates `source_registry` entry
4. Upserts to `tracked_vehicles`
5. Creates snapshot in `inventory_snapshots_unified`

### Running a Competitor Scan
1. Call `scrape-competitor` with URL
2. Results saved to `inventory_snapshots_unified` (global, tenant_id = NULL)
3. Visible to all tenants based on subscription tier

### Deploying Edge Functions
```bash
# Deploy single function
supabase functions deploy upload-universal-csv

# Deploy all functions
supabase functions deploy
```

---

## 9. Troubleshooting

### Common Issues

**"No tenant found with website URL"**
- Check `tenants.website_url` matches the CSV URL
- Ensure URL normalization (no www, https, etc.)

**"RLS policy violation"**
- Check user's `tenant_id` matches the data
- Verify role (`super_admin`, `va_uploader`, `tenant_admin`)

**"Scraping returned 0 vehicles"**
- Check if site blocks bots
- Try Python scraper first (better bypass)
- Check scraper service URLs are correct

### Logs
- Supabase Dashboard → Edge Functions → Logs
- Database logs: `scraping_logs` table
- Upload logs: `manual_scraping_uploads` table

---

## 10. Roadmap & Priorities

### 🔴 HIGH PRIORITY (Do First)

1. **Frontend Migration** - Update pages to use unified tables
   - `ManageInventoryPage.tsx`
   - `CompetitorAnalysisPage.tsx`
   - `AdminPage.tsx`
   - `OnboardingPage.tsx`

2. **Database Cleanup** - Run cleanup migration
   - Execute `20251127000001_cleanup_legacy_tables.sql`
   - Verify data integrity first

3. **Waiting List Consolidation** - Merge into `source_registry`
   - `scraping_waiting_list` → `source_registry`
   - `competitor_scraping_waiting_list` → `source_registry`

### 🟡 MEDIUM PRIORITY

4. **Improve Scraping Reliability**
   - Better error handling
   - Retry logic
   - Pattern caching

5. **Analytics Dashboard**
   - Use `inventory_snapshots_unified` for trends
   - Cross-source comparisons

### 🟢 LOW PRIORITY

6. **AI Recommendations**
   - Pricing suggestions
   - Inventory optimization

7. **Mobile App**
   - React Native version

---

## 📁 Project Structure

```
dealer-copilot/
├── src/                          # Frontend React app
│   ├── components/               # Reusable UI components
│   ├── contexts/                 # React contexts (Auth)
│   ├── lib/                      # Utilities (Supabase client)
│   ├── pages/                    # Page components
│   ├── services/                 # API service functions
│   └── types/                    # TypeScript types
├── supabase/
│   ├── functions/                # Edge functions
│   │   ├── legacy/               # ⚠️ DEPRECATED functions
│   │   ├── _shared/              # Shared utilities
│   │   └── [function-name]/      # Active functions
│   └── migrations/
│       ├── archive/              # ⚠️ OLD migrations
│       └── *.sql                 # Active migrations
├── playwright-scraper-service/   # Playwright scraper (DigitalOcean)
├── python-scraper-service/       # Python scraper (DigitalOcean)
└── public/                       # Static assets
```

---

## 🔗 Related Documentation

- `supabase/DATABASE_AUDIT_QUERIES.sql` - Queries for database analysis
- `supabase/functions/README.md` - Edge function details
- `playwright-scraper-service/README.md` - Scraper service docs
- `python-scraper-service/README.md` - Python scraper docs

---

**Last Updated By:** System  
**Date:** November 27, 2025
