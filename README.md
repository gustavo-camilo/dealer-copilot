DEALER CO-PILOT: Complete System Documentation
SUPABASE EDGE FUNCTIONS
1. decode-vin (supabase/functions/decode-vin/index.ts:1)
Purpose: Decodes Vehicle Identification Numbers (VINs) to retrieve detailed vehicle information. How it works:
Receives a VIN from the client
Calls the Auto.dev API using the AUTODEV_API_KEY environment variable
Returns decoded vehicle data including make, model, year, trim, engine specs, etc.
Why we need it:
VINs contain encoded information about vehicles that humans can't easily read
This function acts as a proxy to the Auto.dev API, keeping the API key secure on the server
Essential for the VIN scanning feature where dealers scan VINs at auctions to get instant vehicle details
Enables the system to auto-populate vehicle data when only a VIN is available
2. market-search (supabase/functions/market-search/index.ts:1)
Purpose: Searches for similar vehicles currently listed for sale in the market. How it works:
Takes vehicle parameters (year, make, model, zip code, radius, mileage)
Calls the Marketcheck API to find similar vehicles within a geographic radius
Applies a mileage range filter (±10,000 miles from the input mileage)
Returns active market listings with pricing data
Why we need it:
Helps dealers understand market pricing for specific vehicles
Critical for the VIN scan recommendation engine - when a dealer scans a VIN at auction, this shows what similar vehicles are selling for
Enables data-driven bidding decisions by showing current market prices
Supports the "max bid suggestion" feature by providing real-time competitive pricing
3. upload-universal-csv (supabase/functions/upload-universal-csv/index.ts:1)
Purpose: Universal CSV uploader that handles both dealer inventory and competitor data uploads. How it works:
Authentication: Verifies user has super_admin or va_uploader role
Domain Detection: Extracts domain from CSV URLs and validates single-source per file
Source Resolution:
Checks source_registry table to see if this source exists
If not found, checks if it matches a tenant's website (makes it a dealer source)
If no tenant match, creates it as a competitor source
Vehicle Processing:
Validates or generates VINs (creates pseudo-VINs for vehicles without real VINs)
Calculates first_seen_at dates from Days_In_Stock field
Upserts vehicles into tracked_vehicles table
Sold Detection: Marks vehicles as "sold" if they were in the previous upload but not in the current one
Snapshot Creation: Creates aggregated statistics in inventory_snapshots_unified
Status Updates: Updates tenant inventory_status to "ready" for dealer uploads
Why we need it:
Single endpoint for both dealer and competitor data uploads
Eliminates code duplication - one function handles all CSV uploads
Automatically distinguishes between dealer inventory (tenant-owned) and competitor data (global)
Critical for the manual scraping workflow where VAs upload CSV files
Handles edge cases like vehicles without VINs by generating unique identifiers
Maintains price history for tracking market changes over time
4. scrape-dealer-inventory (supabase/functions/scrape-dealer-inventory/index.ts:1)
Purpose: Automated web scraping function that crawls dealer websites to extract inventory data. How it works:
Multi-Tier Scraping Strategy (cascading fallback):
Tier 1: Python scraper (undetected-chromedriver) - best bot detection bypass
Tier 2: Playwright scraper - JavaScript-heavy sites
Tier 3: HTML parser - simple extraction from static HTML
Inventory Discovery:
Finds inventory pages by analyzing homepage links
Tests common paths like /inventory, /used-cars, /vehicles
Data Enhancement:
Fetches individual vehicle detail pages to get complete data (VINs, stock numbers)
Enriches data using VIN decoder if VIN available but data missing
Date Extraction:
Uses sitemap analysis to find actual listing dates
Extracts dates from image filenames
Provides confidence scores for date accuracy
Vehicle Lifecycle Tracking:
Marks new vehicles with accurate listing dates
Updates existing vehicles (preserves data, tracks price changes)
Automatically detects sold vehicles (missing from website for 2+ days)
Creates sales records with days-to-sale metrics
Review Mode: Optional review_mode parameter saves results for admin approval before updating database
Why we need it:
Automates inventory tracking instead of requiring manual CSV uploads
Builds accurate sales history by tracking when vehicles appear/disappear from websites
Multi-tier approach ensures high success rate across different website platforms
Accurate date extraction (from sitemaps/images) gives true days-in-inventory metrics
Critical for generating AI recommendations based on real sales performance
Enables continuous monitoring of dealer inventory without manual intervention
5. manage-scraping-queue (supabase/functions/manage-scraping-queue/index.ts:1)
Purpose: Admin function to manage the scraping queue (update status, assign tasks, set priority). How it works:
Accepts actions: update_status, assign, delete, update_priority
Updates source_registry table based on action
Only accessible to super_admin and va_uploader roles
Why we need it:
Provides workflow management for the VA team
Allows admins to assign scraping tasks to specific VAs
Enables priority management for urgent clients
Supports deletion of invalid/duplicate queue entries
6. get-waiting-list (supabase/functions/get-waiting-list/index.ts:1)
Purpose: Retrieves the list of dealers waiting for initial inventory setup. How it works:
Finds all tenants where inventory_status != 'ready'
Auto-creates scraping_waiting_list entries for tenants without one
Enriches entries with tenant details and assigned user info
Sorts by priority (high to low) and request date (old to new)
Why we need it:
Powers the admin "Waiting List" dashboard showing which dealers need setup
Automatically tracks new signups that need inventory configuration
Ensures no tenant falls through the cracks during onboarding
Provides VAs with a prioritized work queue
7. notify-vas-slack (supabase/functions/notify-vas-slack/index.ts:1)
Purpose: Sends Slack notifications to the VA team when new dealerships need scraping. How it works:
Queries scraping_waiting_list for entries with status='pending' and notified_at IS NULL
Formats rich Slack messages with dealership details, priority, contact info
Posts to Slack webhook
Updates notified_at timestamp to prevent duplicate notifications
Why we need it:
Real-time notifications ensure VAs respond quickly to new requests
Rich formatting makes it easy to triage urgent requests (priority emojis)
Prevents duplicate notifications by tracking notified_at
Integrates the scraping workflow with team communication tools
8. get-scraping-queue
Purpose: Retrieves the full scraping queue for admin dashboard. (Note: I haven't read this file yet - would you like me to read the remaining functions?)
9. scrape-competitor
Purpose: Scrapes competitor dealer websites to track their inventory and pricing. (Not yet read)
10. approve-scraping-results
Purpose: Approves pending scraping results from review mode. (Not yet read)
11. get-competitor-waiting-list
Purpose: Retrieves competitor analysis requests from tenants. (Not yet read)
12. export-tenant-inventory
Purpose: Exports a tenant's inventory data as CSV. (Not yet read)
DATABASE TABLES
Let me now provide detailed documentation for each table:
Core Multi-Tenancy Tables
1. tenants (20251111224730_001_create_tenants_and_users.sql:41)
Purpose: Stores dealership accounts (customers of the platform). Key Fields:
id: Unique tenant identifier
name: Dealership name
website_url: Dealer's website (used for scraping)
zip_code: Location for market searches
status: Account status (active/trial/suspended/cancelled)
plan_type: Subscription tier (free/basic/pro/enterprise)
cost_settings: JSONB with auction fees, reconditioning costs, target margins
inventory_status: Tracks if initial inventory is loaded (pending/processing/ready/failed)
inventory_ready_at: Timestamp when inventory first became available
Why we need it:
Foundation of multi-tenant architecture - all data isolates by tenant
Stores business parameters (costs, margins) for profit calculations
Tracks onboarding progress via inventory_status
Enables subscription management and feature gating
2. users (20251111224730_001_create_tenants_and_users.sql:57)
Purpose: User accounts with role-based access control. Key Fields:
id: References auth.users (Supabase Auth)
tenant_id: Associates user with a dealership
role: Access level (super_admin/tenant_admin/tenant_user/va_uploader)
is_active: Enable/disable access without deleting account
Why we need it:
Links Supabase Auth to business logic
Enables multiple users per dealership with different permissions
super_admin: Platform administrators (full access)
tenant_admin: Dealership managers (can manage users, settings)
tenant_user: Salespeople (can scan VINs, view reports)
va_uploader: Virtual assistants (can upload CSV files)
Row Level Security (RLS):
Users can only see data for their own tenant
Super admins bypass tenant restrictions
Prevents data leakage between dealerships
Vehicle Tracking Tables
3. tracked_vehicles (20251126000001_create_unified_vehicle_tracking.sql:4)
Purpose: Unified table tracking BOTH dealer inventory and competitor vehicles. Key Design Decision - Tenant ID can be NULL:
tenant_id = NULL: Competitor vehicle (visible to all tenants)
tenant_id = UUID: Dealer's own vehicle (tenant-scoped)
Key Fields:
source_url: Website domain (grouping identifier)
source_type: 'dealer' or 'competitor'
vin: Vehicle identification number (or pseudo-VIN)
first_seen_at: When vehicle first appeared online
last_seen_at: Last scrape that found this vehicle
status: 'active', 'sold', or 'removed'
listing_date_confidence: Accuracy of first_seen_at (high/medium/low/estimated)
listing_date_source: How date was determined (sitemap/json_ld/meta_tag/first_scan)
price_history: JSONB array tracking price changes over time
Why we need it:
Replaces separate vehicles and competitor_vehicles tables with unified design
Enables sales history tracking (when vehicles go from active → sold)
Price history supports market trend analysis
Accurate listing dates enable true days-in-inventory calculations
Supports competitive intelligence (dealers see what competitors are listing/selling)
Unique Constraint Logic:
UNIQUE NULLS NOT DISTINCT (tenant_id, source_url, vin)
For dealers: One vehicle per (tenant_id + source_url + VIN)
For competitors: One vehicle per (source_url + VIN) globally
PostgreSQL's NULLS NOT DISTINCT treats NULL tenant_ids as equal
4. inventory_snapshots_unified (20251126000001_create_unified_vehicle_tracking.sql:114)
Purpose: Daily aggregated statistics for both dealer and competitor inventories. Key Fields:
tenant_id: NULL for competitors, UUID for dealers
source_url: Website being tracked
snapshot_date: Date of snapshot (one per source per day)
vehicle_count: Total vehicles found
avg_price, min_price, max_price: Price statistics
avg_mileage, min_mileage, max_mileage: Mileage statistics
make_distribution: JSONB like {"Ford": 15, "Chevy": 12}
price_distribution: JSONB price ranges
scraping_duration_ms: Performance tracking
status: 'pending', 'success', 'partial', 'failed', 'pending_review'
raw_data: JSONB storing full vehicle list for review mode
Why we need it:
Historical tracking of inventory changes over time
Powers analytics dashboards showing inventory trends
Stores review-mode scraping results before approval
Enables competitive benchmarking (compare your inventory to competitors)
Performance monitoring via duration tracking
5. source_registry (20251126000001_create_unified_vehicle_tracking.sql:223)
Purpose: Registry of all websites being tracked (dealer and competitor). Key Fields:
source_url: Normalized website domain
source_type: 'dealer' or 'competitor'
tenant_id: NULL for competitors, links to tenant for dealers
scraping_enabled: Toggle scraping on/off
last_scraped_at: Last successful scrape
next_scheduled_scrape: When to scrape next
scraping_frequency_hours: How often to scrape (default 24h)
Why we need it:
Central registry prevents duplicate scraping efforts
Scheduling system for automated scraping
Tracks scraping history and performance
Supports migration scenario (competitor becomes customer)
VIN Scanning & Recommendations
6. vin_scans (20251111224846_003_create_sales_scans_recommendations.sql:104)
Purpose: Stores every VIN scan performed by dealers at auctions. Key Fields:
vin: Scanned VIN
decoded_data: Vehicle specs from VIN decoder
recommendation: 'buy', 'caution', or 'pass'
confidence_score: 0-100 confidence in recommendation
match_reasoning: JSONB array of reasons (positive/negative/neutral)
market_data: Current market listings for similar vehicles
estimated_profit: Projected profit if purchased
max_bid_suggestion: AI-suggested maximum bid price
scan_location: Auction name
saved_to_bid_list: Flagged for follow-up
Why we need it:
Core feature: instant buy/don't-buy recommendations at auctions
Historical record of all scans (audit trail, learning data)
Enables "bid list" feature for tracking vehicles of interest
Market data snapshot preserves pricing at time of scan
Powers analytics on scanning patterns and hit rates
7. recommendations (20251111224846_003_create_sales_scans_recommendations.sql:121)
Purpose: AI-generated "sweet spot" vehicle recommendations based on sales history. Key Fields:
make, model, year_min, year_max: Vehicle criteria
target_price_min, target_price_max: Acquisition price range
target_mileage_max: Maximum recommended mileage
confidence_score: How confident the AI is in this recommendation
reasoning: Human-readable explanation of why this is recommended
based_on_sales: Whether based on actual sales data or market trends
avg_days_to_sale: Historical performance metric
avg_gross_profit: Historical profit metric
priority: Display ranking
is_active: Show/hide recommendation
Why we need it:
Tells dealers "what to buy" based on data, not gut feel
Generated from analyzing sales_records table
Updates as sales data accumulates
Powers the "Recommendations" dashboard
Influences VIN scan scoring (matches against recommendations)
8. sales_records (20251111224846_003_create_sales_scans_recommendations.sql:85)
Purpose: Historical record of sold vehicles. Key Fields:
vin, year, make, model: Vehicle identification
sale_price: Final selling price
acquisition_cost: What dealer paid (auction price + fees + reconditioning)
gross_profit: Auto-calculated (sale_price - acquisition_cost)
margin_percent: Auto-calculated profit margin
days_to_sale: Days from acquisition to sale
sale_date: When sold
Why we need it:
Training data for AI recommendation engine
Identifies profitable vehicle types (basis for recommendations)
Tracks dealership performance over time
Enables "sweet spot" analysis (which cars sell fast with good profit)
Auto-populated by scraper when vehicles disappear from website
Automatic Calculation Trigger:
CREATE TRIGGER calculate_sales_profit
  BEFORE INSERT OR UPDATE ON sales_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_profit();
Automatically calculates gross_profit and margin_percent
Ensures data consistency
Manual Scraping Workflow
9. manual_scraping_uploads (20251119000001_create_manual_scraping_tables.sql:2)
Purpose: Audit log of CSV file uploads. Key Fields:
uploaded_by: Which VA uploaded the file
filename: Original filename
status: 'processing', 'completed', 'failed', 'pending_review'
vehicles_processed: Total rows processed
vehicles_new, vehicles_updated, vehicles_sold: Change summary
error_log: JSONB with any errors encountered
raw_csv_data: Full CSV content for re-processing if needed
scraping_source: 'dealer_inventory' or 'competitor_data'
Why we need it:
Audit trail for compliance and debugging
Tracks VA performance (uploads per VA, success rates)
Enables re-processing if issues found
Quality control for manual uploads
10. scraping_waiting_list (20251119000001_create_manual_scraping_tables.sql:20)
Purpose: Queue of dealers waiting for initial inventory setup. Key Fields:
tenant_id: Which dealership needs setup
website_url: URL to scrape
status: 'pending', 'assigned', 'in_progress', 'completed'
assigned_to: Which VA is handling this
priority: Urgency level (1-5)
notified_at: When Slack notification was sent
Why we need it:
Onboarding workflow management
Prevents new signups from being forgotten
Priority system for VIP clients or urgent requests
Integrates with Slack notifications
11. competitor_scraping_waiting_list (20251120000002_create_competitor_waiting_list.sql:17)
Purpose: Queue of competitor websites that tenants want tracked. Key Fields:
tenant_id: Which dealership requested this
competitor_url: Competitor website to scrape
competitor_name: Friendly name for display
status: 'pending', 'in_progress', 'completed'
priority: Urgency (1-5)
Why we need it:
Allows tenants to request competitor tracking
Separate queue from dealer onboarding
Enables competitive intelligence feature
Supporting Tables
12. vehicle_comments (20251125000001_create_vehicle_comments_and_auctions.sql:14)
Purpose: Notes and comments on VIN scans. Key Fields:
vin_scan_id: Which scan this comment is about
user_id: Who wrote the comment
comment: Text content
auction_source_id: Which auction this relates to
auction_source_name: Denormalized for history preservation
Why we need it:
Collaboration between dealership staff
Track follow-up actions ("needs inspection", "bid up to $15k")
Historical record even if auction source is deleted
13. auction_sources (20251125000001_create_vehicle_comments_and_auctions.sql:2)
Purpose: List of auctions each dealership uses. Key Fields:
tenant_id: Which dealership
name: Auction name (Manheim, ACV, OpenLane, etc.)
is_default: Pre-select in UI
display_order: Sort order
Why we need it:
Dropdown list when scanning VINs
Customizable per dealership
Auto-populated with defaults for new tenants
Auto-Population Trigger:
CREATE TRIGGER trigger_insert_default_auction_sources
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION insert_default_auction_sources();
Automatically creates default auction sources when tenant signs up
14. support_tickets (20251122173000_create_support_tickets.sql:2)
Purpose: Customer support ticketing system. Key Fields:
type: 'missing_market_data', 'bug', 'feature_request', 'other'
subject: Title
details: JSONB with additional context
status: 'open', 'in_progress', 'resolved', 'closed'
priority: 'low', 'medium', 'high', 'urgent'
Why we need it:
In-app support system
Tracks issues without external tools
Type categorization for analytics
15. subscriptions (20251111224846_003_create_sales_scans_recommendations.sql:144)
Purpose: Subscription billing management. Key Fields:
tenant_id: One subscription per tenant
plan_type: 'free', 'basic', 'pro', 'enterprise'
status: 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
billing_interval: 'monthly' or 'yearly'
current_period_start/end: Billing period
stripe_customer_id, stripe_subscription_id: Stripe integration
Why we need it:
Integrates with Stripe for payment processing
Tracks subscription lifecycle
Enables feature gating based on plan type
Manages trial periods


Create comprehensive system documentation
DEALER CO-PILOT: COMPREHENSIVE SYSTEM DOCUMENTATION
SYSTEM OVERVIEW
Dealer Co-Pilot is a SaaS platform that helps used car dealers make data-driven purchasing decisions at auctions and track their inventory performance. The system combines:
VIN Scanning: Instant buy/pass recommendations when scanning vehicles at auctions
Inventory Tracking: Automated scraping of dealer websites to build sales history
Competitive Intelligence: Track competitor inventory and pricing
AI Recommendations: Machine learning that identifies "sweet spot" vehicles based on historical sales data
COMPLETE EDGE FUNCTIONS DOCUMENTATION
1. decode-vin (supabase/functions/decode-vin/index.ts:1)
Purpose: VIN decoder that translates a 17-character VIN into vehicle specifications. How it works:
Receives VIN from client
Validates VIN format (17 characters, no I/O/Q)
Calls Auto.dev API via environment variable AUTODEV_API_KEY
Returns year, make, model, trim, body type
Why we need it:
VINs encode vehicle information that humans can't read
Acts as secure proxy (API key stays on server, never exposed to client)
Critical for VIN scanner feature - dealers scan VIN at auction and instantly get vehicle details
Enables quick data entry without manual typing
Data Flow:
Client → Edge Function → Auto.dev API → Edge Function → Client
Security: Only accepts authenticated requests, API key is server-side only.
2. market-search (supabase/functions/market-search/index.ts:1)
Purpose: Searches current market listings to find similar vehicles and their prices. How it works:
Accepts parameters: year, make, model, zip code, radius (miles), optional mileage
Constructs Marketcheck API query:
Year range: ±1 year from input
Mileage range: ±10,000 miles from input (if provided)
Geographic radius from zip code
Returns active market listings with pricing
Why we need it:
Provides real-time market intelligence for pricing decisions
Powers the "max bid suggestion" in VIN scanner
Enables dealers to know if a vehicle is priced competitively
Used by recommendation engine to calculate profit potential
Example:
// Dealer scanning 2020 Honda Civic with 50k miles in Dallas (75201)
→ Searches for 2019-2021 Honda Civic, 40k-60k miles, within 50 miles of 75201
→ Returns 15 active listings: $18,500 - $22,000
→ Calculates average: $20,250
→ Suggests max bid based on target margin
3. upload-universal-csv (supabase/functions/upload-universal-csv/index.ts:1)
Purpose: Universal CSV upload handler for both dealer inventory and competitor data. How it works (step-by-step): Step 1: Authentication
Verifies user has super_admin or va_uploader role
Only VAs and admins can upload CSVs
Step 2: CSV Parsing
Custom parser handles quoted fields, commas in data, line breaks
Extracts headers and maps to expected columns
Handles variations: URL/Dealership_URL, Image_URL/Photo_URL, etc.
Step 3: Domain Detection & Validation
Extracts domain from URL column (e.g., www.johnsautosales.com)
Validates single source per file (prevents mixing multiple dealers in one upload)
Throws error if multiple domains detected
Step 4: Source Resolution (Critical Logic):
Is domain in source_registry?
├─ YES → Use existing source
└─ NO → Is domain in tenants.website_url?
    ├─ YES → Create dealer source (tenant_id = tenant.id)
    └─ NO → Create competitor source (tenant_id = NULL)
Step 5: VIN Processing
For each row:
Validates VIN if present (checksum algorithm)
If invalid/missing VIN: generates pseudo-VIN
Pseudo-VIN format: noVIN_2020_HONDA_CIVIC_45000 (year_make_model_mileage)
Ensures uniqueness even for vehicles without real VINs
Step 6: Date Calculation
Uses Days_In_Stock column to back-calculate first_seen_at:
first_seen_at = today - days_in_stock
// If Days_In_Stock = 15, first_seen_at = 15 days ago
Step 7: Vehicle Upsert
Database constraint: UNIQUE NULLS NOT DISTINCT (tenant_id, source_url, vin)
For dealers: Unique per (tenant_id, source, VIN)
For competitors: Unique per (NULL, source, VIN)
PostgreSQL NULLS NOT DISTINCT: Treats all NULL values as equal (critical for competitor vehicles)
Step 8: Sold Detection
Compares previous upload to current upload
Vehicles missing from current upload → marked as "sold"
Updates status = 'sold' and last_seen_at = NOW()
Step 9: Snapshot Creation
Aggregates statistics:
vehicle_count, avg_price, min_price, max_price
avg_mileage, min_mileage, max_mileage
make_distribution: {"Ford": 12, "Chevy": 8}
total_inventory_value: Sum of all prices
Stores in inventory_snapshots_unified
Step 10: Tenant Status Update (Dealer uploads only)
Sets inventory_status = 'ready'
Sets inventory_ready_at = NOW()
Enables dashboard features for dealer
Why we need it:
Single endpoint replaces separate dealer/competitor upload functions (DRY principle)
Automatically classifies uploads as dealer vs competitor data
Handles edge cases: vehicles without VINs, duplicate detection
Critical for manual scraping workflow (VA team uploads CSV files from scraping)
Maintains price history for trend analysis
Security: RLS ensures tenants can only see their own data; competitors are global (NULL tenant_id).
4. scrape-dealer-inventory (supabase/functions/scrape-dealer-inventory/index.ts:1)
Purpose: Fully automated website scraping to track dealer inventory and build sales history. How it works (Multi-Tier Scraping): Tier 1: Python Scraper (Priority)
Uses undetected-chromedriver (best bot detection bypass)
Deployed on DigitalOcean: PYTHON_SCRAPER_URL
Handles JavaScript-heavy sites, bypasses Cloudflare
Returns confidence level: "high", "medium", "low"
Tier 2: Playwright Scraper (Fallback)
Headless browser automation
4-tier extraction system (JSON-LD → Meta tags → Visible text → Pattern matching)
Deployed on DigitalOcean: PLAYWRIGHT_SERVICE_URL
Tier 3: HTML Parser (Last Resort)
Direct HTTP fetch + regex parsing
No JavaScript execution
Fast but limited to static HTML sites
Cascading Fallback Logic:
Try Python → Success? Done ✓
    ↓
   Fail → Try Playwright → Success? Done ✓
    ↓
   Fail → Try HTML Parser → Success? Done ✓
    ↓
   Fail → Return error ✗
Inventory Discovery:
// Tries common paths in order:
[
  '/inventory', '/inventory.html', '/vehicles',
  '/used-cars', '/cars', '/pre-owned',
  '/search', '/stock', '/cars-for-sale'
]
Pagination Handling:
Detects "Next" buttons automatically
Follows pagination up to 20 pages (safety limit)
Tracks seen URLs to avoid duplicates
Stops when no new vehicles found
Data Enhancement:
Fetches individual vehicle detail pages (5 concurrent requests)
Extracts complete data: VIN, stock number, specs, images
Only fetches detail pages if missing critical data
Validates data matches (prevents mixing different vehicles)
Date Extraction Strategy (Most Important Feature): Why accurate dates matter:
Inaccurate first_seen_at ruins "days to sale" metrics
AI recommendations rely on true sales velocity
Example: If a car listed Dec 1st shows first_seen_at = Dec 15th, it appears to have sold in -14 days!
Multi-Source Date Detection:
Sitemap.xml: Pre-fetches sitemap, maps URLs to lastmod dates
Confidence: "high"
Source: "sitemap"
Structured Data (JSON-LD):
<script type="application/ld+json">
{ "@type": "Car", "datePosted": "2024-01-15" }
</script>
Confidence: "high"
Source: "json_ld"
Meta Tags:
<meta property="article:published_time" content="2024-01-15">
Confidence: "medium"
Source: "meta_tag"
Image Filenames:
/inventory/2024-Honda-Civic-20240115.jpg
Extracts date from filename patterns
Confidence: "medium"
Source: "image_filename"
First Scan (Fallback):
Uses scrape timestamp
Confidence: "estimated"
Source: "first_scan"
Vehicle Lifecycle Tracking: New Vehicle:
{
  vin: "1HGBH41JXMN109186",
  first_seen_at: "2024-01-15T10:30:00Z", // From sitemap
  last_seen_at: "2024-01-20T14:00:00Z",  // Current scrape
  status: "active",
  listing_date_confidence: "high",
  listing_date_source: "sitemap"
}
Price Change:
{
  price: 18500, // Was $19,000
  price_history: [
    { date: "2024-01-15", price: 19000 },
    { date: "2024-01-20", price: 18500 }
  ]
}
Sold Vehicle (Disappeared for 2+ days):
// Scraper marks as sold
status: "sold" → Creates sales_record:
{
  vin: "1HGBH41JXMN109186",
  sale_price: 18500,          // Last known price
  acquisition_cost: null,     // Unknown from scraping
  days_to_sale: 35,          // Calculated from first_seen_at
  sale_date: "2024-02-19"
}
Review Mode:
// Optional parameter: review_mode=true
{
  status: 'pending_review',
  raw_data: { vehicles: [...] } // Stored for admin approval
}
// Admin approves → vehicles inserted to tracked_vehicles
Why we need it:
Fully automates inventory tracking (no manual CSV uploads)
Builds accurate sales history by detecting when vehicles disappear
Multi-tier scraping ensures high success rate across different website platforms
Date extraction provides true "days in inventory" metrics
Sales velocity data trains AI recommendation engine
Enables automated daily monitoring without human intervention
Performance:
100-second timeout (leaves buffer before 120s Supabase limit)
Processes multiple tenants in single execution
Respectful delays between requests (500ms-800ms)
5. manage-scraping-queue (supabase/functions/manage-scraping-queue/index.ts:1)
Purpose: Admin API to manage the scraping workflow queue. How it works:
Accepts actions: update_status, assign, delete, update_priority
Updates source_registry table
Only super_admin and va_uploader roles have access
Actions:
// Assign task to VA
{ action: 'assign', id: uuid, assigned_to: userId }

// Change priority
{ action: 'update_priority', id: uuid, priority: 5 } // 1-5 scale

// Delete bad entry
{ action: 'delete', id: uuid }
Why we need it:
Powers admin panel workflow
Enables VA assignment system
Supports priority queue for VIP clients
Cleanup tool for duplicate/invalid entries
6. get-waiting-list (supabase/functions/get-waiting-list/index.ts:1)
Purpose: Retrieves dealers waiting for initial inventory setup. How it works:
Finds all tenants where inventory_status != 'ready'
Auto-creates scraping_waiting_list entry if missing
Joins with tenants table for dealership details
Joins with users table for assigned VA info
Sorts by priority (DESC), then requested_at (ASC)
Auto-Creation Logic:
// Ensures every new tenant automatically gets a waiting list entry
if (!existingEntry) {
  INSERT INTO scraping_waiting_list {
    tenant_id, website_url, status: 'pending', priority: 2
  }
}
Why we need it:
Powers "Waiting List" admin dashboard
Prevents new signups from being forgotten
Automatically tracks onboarding pipeline
Shows VAs which dealers need immediate attention
7. notify-vas-slack (supabase/functions/notify-vas-slack/index.ts:1)
Purpose: Sends Slack notifications when new dealers need scraping. How it works:
Queries scraping_waiting_list where status='pending' AND notified_at IS NULL
Formats rich Slack message with dealer details
Posts to Slack webhook (SLACK_WEBHOOK_URL)
Updates notified_at to prevent duplicates
Message Format:
🚨 New Dealership Scraping Request

Dealership: John's Auto Sales
Priority: 🟡 Level 3
Website: johnsautosales.com
Requested: Jan 15, 2024 10:30 AM
Contact: john@johnsautosales.com
Location: Dallas, TX

⚡ Action Required: Log in to admin panel to upload CSV
Priority Emojis:
🔴 Priority ≥ 5 (Urgent)
🟡 Priority ≥ 3 (High)
🟢 Priority < 3 (Normal)
Why we need it:
Real-time team notifications
Ensures fast response to new customers
Priority system highlights VIP clients
Integrates scraping workflow with team communication
8. get-scraping-queue (supabase/functions/get-scraping-queue/index.ts:1)
Purpose: Fetches the full scraping queue with filters. How it works:
Queries scraping_queue_view (database view combining dealer + competitor queues)
Supports filters: status, type (dealer/competitor), assignee
Returns sorted by priority (DESC), requested_at (ASC)
Filters:
// My assigned tasks
?assignee=me

// Only pending competitor scrapes
?status=pending&type=competitor

// Show everything
?status=all&type=all
Why we need it:
Powers admin queue dashboard
Enables filtered views for VAs (show only my tasks)
Unified view of dealer + competitor scraping requests
9. scrape-competitor (supabase/functions/scrape-competitor/index.ts:1)
Purpose: On-demand scraping of competitor dealer websites. How it works: Discovery Phase:
// Tries common paths
['/inventory', '/inventory.html', '/vehicles', '/used-cars']
→ Returns first successful path
Pagination:
Follows "Next" links automatically
Tracks seen vehicle URLs (prevents duplicates)
Max 20 pages (safety limit)
Detail Page Fetching:
Fetches ALL vehicle detail pages (not just summary)
Runs 5 concurrent requests
Retry logic with exponential backoff (403 errors)
User-Agent rotation to bypass bot detection
Data Enrichment:
VIN Decoder: If VIN present but data missing
Date Extraction: Same multi-source strategy as dealer scraper
Image Date Parsing: Extracts dates from image filenames
Statistics Calculation:
{
  vehicle_count: 47,
  avg_price: 24500,
  min_price: 12000,
  max_price: 45000,
  avg_mileage: 62000,
  total_inventory_value: 1151500,
  top_makes: {
    "FORD": 12,
    "CHEVROLET": 8,
    "TOYOTA": 7,
    "HONDA": 6
  }
}
Storage:
Saves to inventory_snapshots_unified with tenant_id = NULL (global)
Available to all tenants (competitive intelligence)
Why we need it:
Competitive intelligence feature
Dealers track competitor pricing and inventory
Identifies market gaps (what competitors are selling that dealer isn't)
Historical tracking shows competitor strategy changes
10. approve-scraping-results (supabase/functions/approve-scraping-results/index.ts:1)
Purpose: Admin approval workflow for review-mode scraping results. How it works: Approval (action: 'approve'):
Fetches snapshot with status = 'pending_review'
Extracts vehicles from raw_data.vehicles
Upserts to tracked_vehicles:
New vehicles → INSERT
Existing vehicles → UPDATE
Missing vehicles → Mark as sold
Updates snapshot status = 'success'
Sets tenant inventory_status = 'ready'
Rejection (action: 'reject'):
Updates snapshot status = 'failed'
Sets error_message = 'Rejected by admin during review'
Data discarded (not applied to tracked_vehicles)
Why we need it:
Quality control for automated scraping
Allows admin review before importing data
Prevents bad scrapes from corrupting database
Learning opportunity: admin sees what scraper extracted
Use Case:
Scraper runs with review_mode=true
→ Results stored in snapshot.raw_data
→ Admin reviews results in dashboard
→ Admin clicks "Approve" or "Reject"
→ Approved results inserted to tracked_vehicles
11. get-competitor-waiting-list (supabase/functions/get-competitor-waiting-list/index.ts:1)
Purpose: Retrieves competitor analysis requests from tenants. How it works:
Queries competitor_scraping_waiting_list
Joins with tenants for requestor details
Joins with users for assigned VA
Filters by status (pending/in_progress/completed)
Sorts by priority (DESC), requested_at (ASC)
Why we need it:
Separate queue for competitor requests
Dealers can request competitor tracking
VAs process requests and upload competitor CSVs
12. export-tenant-inventory (supabase/functions/export-tenant-inventory/index.ts:1)
Purpose: Exports dealer inventory as downloadable CSV. How it works:
Fetches all vehicles from tracked_vehicles for tenant
Generates CSV with headers:
VIN, Year, Make, Model, Trim, Price, Mileage, Exterior_Color,
Status, Stock_Number, Listing_URL, First_Photo_URL,
First_Seen_Date, Last_Seen_Date, Days_In_Inventory,
Listing_Date_Confidence, Listing_Date_Source
Calculates Days_In_Inventory = last_seen_at - first_seen_at
Escapes commas and quotes for CSV format
Returns file as attachment: inventory_JohnsAutoSales_2024-01-20.csv
Security:
Non-admin users can only export their own tenant's data
Admins can export any tenant via ?tenant_id=uuid
Why we need it:
Data portability (dealers can download their data)
Integration with other tools (DMS systems)
Backup/archival purposes
Reporting to management
FRONTEND SERVICE FILES
1. vinDecoder.ts (src/services/vinDecoder.ts:1)
Purpose: Client-side VIN decoder with fallback strategy. How it works: Primary: Auto.dev (via Edge Function)
await supabase.functions.invoke('decode-vin', { body: { vin } })
Fallback: NHTSA (Direct API call)
fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json')
Cascading Strategy:
Try Auto.dev → Success? Return ✓
    ↓
   Fail → Try NHTSA → Success? Return ✓
    ↓
   Fail → Return error ✗
Why we need it:
Resilience: If Auto.dev fails, NHTSA provides free fallback
Auto.dev has more detailed data (trim, style)
NHTSA is always available (government API)
2. marketcheck.ts (src/services/marketcheck.ts:1)
Purpose: Market pricing data fetcher and processor. How it works: Search:
await supabase.functions.invoke('market-search', {
  body: { year, make, model, zip, radius, mileage }
})
Processing:
processMarketcheckData(response) {
  prices = [18500, 19200, 17800, ...]
  
  return {
    averagePrice: mean(prices),
    medianPrice: median(prices),
    minPrice: min(prices),
    maxPrice: max(prices),
    confidence: listings > 10 ? 90 : (listings > 5 ? 70 : 50),
    listings: [...] // Array of individual listings
  }
}
Confidence Scoring:
10+ listings: 90% confidence
5-9 listings: 70% confidence
< 5 listings: 50% confidence
Why we need it:
Transforms raw API data into usable metrics
Confidence score helps UI show reliability
Median price less affected by outliers than average
3. marketPricing.ts (src/services/marketPricing.ts:1)
Purpose: High-level market pricing coordinator. How it works: getMarketPricing(): Wrapper function
async getMarketPricing(vehicleData, zipCode) {
  const marketCheckData = await searchActiveListings(...)
  if (marketCheckData && marketCheckData.num_found > 0) {
    return processMarketcheckData(marketCheckData)
  }
  return null // No data found
}
calculateMaxBid(): Iterative solver
// Problem: Auction fee depends on bid amount, but bid amount depends on auction fee!
// Solution: Fixed-point iteration

targetAcquisitionCost = marketPrice / (1 + targetMargin%)
maxBid = targetAcquisitionCost - reconditioningCost - transportCost

// Iterative refinement (up to 5 iterations)
for (i = 0; i < 5; i++) {
  fee = calculateAuctionFee(maxBid, thresholds)
  newMaxBid = targetAcquisitionCost - reconditioningCost - transportCost - fee
  if (abs(newMaxBid - maxBid) < 1) break
  maxBid = newMaxBid
}
Example:
Market price: $20,000
Target margin: 20%
Reconditioning: $1,500
Transport: $300
Auction fees: $0-10k = $300, $10k-20k = $500

Target acquisition = $20,000 / 1.20 = $16,667
Iteration 1: maxBid = $16,667 - $1,500 - $300 = $14,867
  → Fee($14,867) = $500
Iteration 2: maxBid = $16,667 - $1,500 - $300 - $500 = $14,367
  → Fee($14,367) = $500 (converged!)

Final max bid: $14,367
Why we need it:
Single source of truth for pricing calculations
Iterative solver handles circular dependency (fee depends on bid, bid depends on fee)
Used by both VIN scanner and recommendation engine
4. recommendationEngine.ts (src/services/recommendationEngine.ts:1)
Purpose: AI recommendation engine that generates buy/caution/pass decisions. How it works: Scoring System (0-100 scale): 1. Vehicle Condition (Weight: 25%)
score = 70 (base)

// Age
if (age ≤ 3 years) score += 15
if (age ≤ 6 years) score += 5
if (age ≥ 10 years) score -= 15

// Mileage
if (mileage < 50k) score += 15
if (mileage below average for age) score += 10
if (mileage significantly above average) score -= 15

// Title
if (clean title) score += 10
if (salvage) score -= 40
if (rebuilt) score -= 20

// Accidents
if (no accidents) score += 10
if (2+ accidents) score -= 15
2. Market Demand (Weight: 20%)
if (marketData.confidence ≥ 80) score += 10
if (marketData.confidence < 50) score -= 10
3. Dealer History (Weight: 30%) - MOST IMPORTANT
// Find similar vehicles in sales_records
similarVehicles = salesHistory.filter(
  sale => sale.make === vehicle.make && sale.model === vehicle.model
)

if (similarVehicles.length > 0) {
  avgDaysToSale = mean(similarVehicles.days_to_sale)
  avgGrossProfit = mean(similarVehicles.gross_profit)
  
  if (avgDaysToSale ≤ 30) score += 30 // Fast seller!
  if (avgDaysToSale ≤ 45) score += 15 // Moderate
  if (avgDaysToSale > 45) score -= 15 // Slow
  
  if (avgGrossProfit ≥ $2,000) score += 15
}
else {
  // Never sold this model before
  sameMakeVehicles = salesHistory.filter(sale => sale.make === vehicle.make)
  if (sameMakeVehicles.length > 0) {
    if (avg_days ≤ 35) score += 10
  }
  else {
    score -= 10 // Unknown territory
  }
}
4. Profit Potential (Weight: 25%)
estimatedProfit = marketPrice - maxBid
profitMargin = (estimatedProfit / maxBid) * 100

if (profitMargin ≥ targetMargin + 5%) score += 20
if (profitMargin ≥ targetMargin) score += 10
if (profitMargin < targetMargin - 5%) score -= 20
Final Calculation:
totalScore = (
  vehicleCondition * 0.25 +
  marketDemand * 0.20 +
  dealerHistory * 0.30 +
  profitPotential * 0.25
)

// Adjust confidence
if (no sales history) totalScore *= 0.7
if (no market data) totalScore *= 0.5

// Determine recommendation
if (totalScore ≥ 75) recommendation = 'buy'
if (totalScore ≥ 55) recommendation = 'caution'
else recommendation = 'pass'
Reasoning Messages:
[
  { type: 'positive', message: 'Low mileage (45,000 mi) - excellent condition' },
  { type: 'positive', message: 'You've sold 5 similar vehicles in 28 days average (fast!)' },
  { type: 'positive', message: 'Excellent profit potential: $2,500 (18% margin)' },
  { type: 'neutral', message: 'Clean title - no issues' }
]
Why we need it:
Core value proposition: instant data-driven decisions
Learns from dealer's actual sales patterns
Combines multiple factors (condition, history, market, profit)
Explains reasoning (not a black box)
Personalizes to each dealer's "sweet spot"
5. support.ts (src/services/support.ts:1)
Purpose: Support ticket creation service. How it works:
await SupportService.createTicket({
  type: 'missing_market_data',
  subject: 'No market data for 2015 BMW X5',
  details: { vin: '5UXKR0C58F0P05123', year: 2015, make: 'BMW', model: 'X5' },
  priority: 'medium'
})
Ticket Types:
missing_market_data: No listings found for vehicle
bug: Software issue
feature_request: Enhancement request
other: General support
Why we need it:
In-app support system
Captures context (VIN, vehicle data) automatically
No external ticketing system needed
COMPLETE DATABASE TABLES DOCUMENTATION
(Continuing from earlier partial documentation...)
Previously Documented:
✓ tenants
✓ users
✓ tracked_vehicles
✓ inventory_snapshots_unified
✓ source_registry
✓ vin_scans
✓ recommendations
✓ sales_records
✓ manual_scraping_uploads
✓ scraping_waiting_list
✓ competitor_scraping_waiting_list
✓ vehicle_comments
✓ auction_sources
✓ support_tickets
✓ subscriptions
16. competitor_scan_history (Deprecated/Replaced by inventory_snapshots_unified)
Purpose: Previously stored competitor scan history separately. Status: REPLACED by inventory_snapshots_unified which handles both dealer and competitor snapshots in one table. Migration Note: The unified design (single table with tenant_id = NULL for competitors) is more maintainable than separate tables.
KEY SYSTEM PATTERNS
1. Multi-Tenancy Architecture
Data Isolation:
-- Dealer-owned data
SELECT * FROM tracked_vehicles WHERE tenant_id = 'dealer-uuid'

-- Global competitor data
SELECT * FROM tracked_vehicles WHERE tenant_id IS NULL AND source_type = 'competitor'
RLS Policies (Row Level Security):
-- Users can only see their own tenant's data
CREATE POLICY "tenant_isolation" ON tracked_vehicles FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))

-- Competitor data visible to all
CREATE POLICY "competitor_global" ON tracked_vehicles FOR SELECT  
USING (tenant_id IS NULL AND source_type = 'competitor')
2. Unified Vehicle Tracking
Before (Separate Tables):
vehicles (dealer inventory)
competitor_vehicles (competitor data)
vehicle_history (dealer historical)
After (Unified Design):
tracked_vehicles (BOTH dealer AND competitor)
  ├─ tenant_id = UUID → Dealer vehicle
  └─ tenant_id = NULL → Competitor vehicle
Benefits:
Single codebase for both types
Consistent data structure
Easier querying across dealers and competitors
Simpler migrations
3. Pseudo-VIN Generation
Problem: Not all vehicles have VINs (older cars, mis-read VINs, data entry errors) Solution: Generate deterministic unique identifiers
// Priority 1: Use mileage (most stable)
noVIN_2020_HONDA_CIVIC_45000

// Priority 2: Use price
noVIN_2020_HONDA_CIVIC_$18500

// Priority 3: Use URL hash
noVIN_2020_HONDA_CIVIC_A7F2E
Why it works:
Deterministic: Same vehicle generates same pseudo-VIN
Human-readable: Easy to identify in database
Unique: Combination of attributes prevents collisions
4. Sales Detection Logic
Core Insight: Vehicle disappearing from website = sold Implementation:
// Every scrape
currentVINs = scrapeWebsite()
existingVINs = database.query("SELECT vin WHERE status='active'")

soldVINs = existingVINs.filter(vin => !currentVINs.includes(vin))

// Wait 2 days before marking as sold (prevents false positives)
potentiallySold = soldVINs.filter(v => v.last_seen_at < 2.days.ago)

for (vehicle of potentiallySold) {
  database.update({ status: 'sold' })
  database.insert_sales_record({
    sale_price: vehicle.price,
    days_to_sale: today - vehicle.first_seen_at
  })
}
Why 2-day delay?:
Websites sometimes remove vehicles temporarily for photos/maintenance
Prevents false "sold" records
Balances accuracy vs timeliness
5. Date Extraction Hierarchy
Accuracy Ranking:
Sitemap.xml (90%+ accurate) - Most reliable
JSON-LD structured data (85% accurate)
Meta tags (70% accurate)
Image filename dates (60% accurate)
First scan (50% accurate - estimate only)
Why it matters:
Vehicle listed: Dec 1
Scraped first: Dec 15
Sold: Jan 5

With sitemap date (Dec 1):
  Days to sale = 35 days ✓

With first scan date (Dec 15):
  Days to sale = 21 days ✗ (inaccurate!)
SYSTEM WORKFLOWS
Workflow 1: Dealer Onboarding
1. Dealer signs up
   → Creates tenant, user, subscription
   → Sets inventory_status = 'pending'
   → Auto-creates scraping_waiting_list entry

2. System detects new tenant
   → Sends Slack notification to VAs
   → Entry appears in admin dashboard

3. VA uploads dealer CSV
   → Calls upload-universal-csv
   → Creates source_registry entry (source_type='dealer')
   → Upserts vehicles to tracked_vehicles
   → Creates inventory_snapshot
   → Sets inventory_status = 'ready'

4. Dealer dashboard now shows inventory
   → Stats cards populate
   → Recommendations generate (if sales history exists)
Workflow 2: VIN Scanning at Auction
1. Dealer scans VIN barcode
   → Calls decode-vin edge function
   → Returns: 2020 Honda Civic LX

2. System fetches market data
   → Calls market-search edge function
   → Finds 15 listings: $18,500 - $22,000
   → Average: $20,250

3. System calculates max bid
   → Target margin: 20%
   → Auction fees: $500
   → Reconditioning: $1,500
   → Transport: $300
   → Max bid: $14,367

4. System checks dealer history
   → Finds 5 similar Civics sold in avg 28 days
   → Avg profit: $2,200

5. Recommendation engine scores
   → Condition: 85/100 (3 years old, 45k miles, clean title)
   → Market: 75/100 (good data confidence)
   → History: 95/100 (fast seller for this dealer)
   → Profit: 80/100 (good margin)
   → Total: 84/100 → BUY ✓

6. Result saved to vin_scans table
   → Shows on dashboard
   → Available for future reference
Workflow 3: Automated Nightly Scraping
1. Cron job triggers scrape-dealer-inventory
   → Runs at 2 AM daily

2. For each active tenant:
   → Python scraper tries first
   → If fails: Playwright scraper
   → If fails: HTML parser

3. Scraper fetches inventory
   → Discovers pagination
   → Fetches detail pages
   → Extracts listing dates from sitemap

4. System compares to yesterday's data
   → New vehicles: INSERT with accurate first_seen_at
   → Updated vehicles: UPDATE price, mileage
   → Missing vehicles (2+ days): Mark as sold

5. Sold vehicle creates sales_record
   → Days to sale = today - first_seen_at
   → Sale price = last known price

6. System creates snapshot
   → Aggregates statistics
   → Stores in inventory_snapshots_unified

7. Recommendation engine runs
   → Analyzes sales_records
   → Updates recommendations table
   → Identifies "sweet spot" vehicles
CONCLUSION
This system represents a complete end-to-end solution for used car dealers: Core Value: Transform gut-feel purchasing into data-driven decisions Key Innovations:
Automated Sales History: Web scraping builds sales data automatically
Accurate Date Extraction: Multi-source date detection for true metrics
Personalized AI: Learns each dealer's unique "sweet spot"
Instant Recommendations: Real-time buy/pass decisions at auctions
Competitive Intelligence: Track competitor inventory and pricing
Technical Highlights:
Multi-tier scraping (Python → Playwright → HTML) ensures high success rate
Unified data model (tracked_vehicles) simplifies codebase
Pseudo-VIN generation handles edge cases
RLS ensures tenant data isolation
Iterative solver for circular dependencies (auction fees)
Business Impact:
Dealers make faster, better purchasing decisions
Historical data shows what actually sells (not what they think sells)
Competitive intelligence reveals market gaps
Automation eliminates manual tracking