# Dealer Co-Pilot System Documentation

## 1. System Overview

**Dealer Co-Pilot** is a mobile-first acquisition intelligence platform designed for automotive dealers. It serves as a comprehensive tool to analyze dealership inventory, provide smart buy recommendations, scan VINs at auctions for instant guidance, and track sales performance.

The system is built as a **Multi-Tenant SaaS** application, allowing multiple dealerships to use the platform with strict data isolation. It also includes a **Super Admin Dashboard** for managing tenants and subscriptions.

## 2. Core Functionalities

### 🚗 Acquisition & Inventory Intelligence
- **Instant Portfolio Analysis**: Scans dealership websites to provide comprehensive inventory insights in under 30 seconds.
- **AI-Powered Recommendations**: Analyzes inventory profiles and sales history to suggest "smart buys" – vehicles that are likely to sell fast and profitably.
- **Sales Tracking**: Tracks sales data to identify the "sweet spot" for each dealer.

### 📱 Mobile Tools
- **VIN Scanner**: A mobile-friendly tool for scanning VINs at auctions. It provides instant "buy/no-buy" guidance with profit calculations based on the dealer's specific data.

### 🤖 Robust Scraping System
The system features a highly sophisticated, self-hosted **Playwright Scraper Service** designed to extract inventory data from *any* dealer website.
- **4-Tier Extraction Strategy**:
    1.  **API Interception**: Captures hidden JSON APIs (fastest, 70-80% success).
    2.  **Structured Data (JSON-LD)**: Parses Schema.org markup.
    3.  **Smart Selector Discovery**: Auto-discovers CSS selectors using common patterns.
    4.  **LLM Vision (Claude)**: Uses AI to visually analyze and extract data from screenshots as a fallback (learns and caches patterns).
- **Stealth Mode**: Uses advanced techniques to bypass bot detection (Cloudflare, WAFs) by masking automation fingerprints.
- **Pattern Caching**: Caches successful extraction patterns in Supabase to speed up future scrapes.

### 🏢 Multi-Tenancy & Administration
- **Tenant Isolation**: Data is isolated via `tenant_id` and Row Level Security (RLS) policies.
- **Role-Based Access**: Supports `super_admin`, `tenant_admin`, and `tenant_user` roles.
- **Subscription Management**: Handles billing and subscription status.

## 3. Technical Architecture & Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel / Netlify compatible

### Backend & Database
- **Platform**: Supabase
- **Database**: PostgreSQL
- **Security**: Row Level Security (RLS) for tenant isolation
- **Authentication**: Supabase Auth
- **Edge Functions**: TypeScript (Deno) for server-side logic (e.g., triggering scrapes)

### Scraper Service
- **Core**: Playwright (TypeScript)
- **Hosting**: Railway (Dockerized)
- **AI**: Anthropic Claude (for Vision-based extraction)
- **Stealth**: `puppeteer-extra-plugin-stealth`

## 4. How It Works (Data Flow)

1.  **User Action**: A dealer enters a URL or scans a VIN via the React frontend.
2.  **Request Handling**: The frontend calls a Supabase Edge Function.
3.  **Scraping (if applicable)**:
    - The Edge Function calls the hosted Playwright Service.
    - The service attempts extraction using the 4-Tier system.
    - Successful patterns are cached in the `scraper_domain_patterns` table.
    - Extracted vehicle data is returned and stored in the `vehicles` table.
4.  **Data Processing**: The system analyzes the new data against sales history (`sales_records`) to generate insights.
5.  **Presentation**: The frontend displays insights, recommendations, or scan results to the user.

## 5. Future Goals & Roadmap

Based on the current implementation status and analysis, the immediate next steps and future goals are:

### 🚀 Immediate Next Steps
- **Deploy Stealth Mode**: Finalize the deployment of the stealth-enabled scraper to unlock protected sites (e.g., `nexautoga.com`).
- **End-to-End Testing**: Verify the complete flow from UI -> Edge Function -> Scraper Service -> Database for all supported tiers.
- **Feed Detection**: Enhance the scraper to automatically detect XML/RSS inventory feeds as a primary data source.

### 🔮 Long-Term Goals
- **Proxy Integration**: Implement residential proxy rotation for sites that remain blocked even with stealth mode.
- **Advanced Analytics**: Deepen the "sweet spot" analysis with more granular market data.
- **Direct DMS Integration**: Move beyond scraping to direct integration with Dealer Management Systems (DMS) where possible.
