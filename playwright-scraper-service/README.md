# Playwright Scraper Service

A robust, production-ready vehicle inventory scraper with intelligent 4-tier extraction:

1. **API Interception** - Captures JSON APIs (highest reliability, fastest)
2. **Structured Data** - Parses JSON-LD, Schema.org (very reliable)
3. **Smart Selectors** - Auto-discovers CSS selectors (good reliability)
4. **LLM Vision** - Claude Vision fallback (works on any website)

## Features

- ✅ **Universal Coverage** - Works on ANY dealer website structure
- ✅ **Self-Learning** - Caches successful patterns to avoid re-discovery
- ✅ **Cost-Effective** - $15-30/month total cost (vs $60-200 for SaaS alternatives)
- ✅ **High Reliability** - 4-tier fallback system ensures success
- ✅ **Production-Ready** - Docker, health checks, graceful shutdown
- ✅ **Anti-Bot Resistant** - Stealth mode, realistic browser fingerprints

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-api-key
PORT=3000
```

### 3. Run Database Migration

Run the SQL in `supabase-migration.sql` in your Supabase SQL editor to create the pattern cache table.

### 4. Start Development Server

```bash
npm run dev
```

The server will start on http://localhost:3000

## API Usage

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Scrape Endpoint

```bash
POST /scrape
Content-Type: application/json

{
  "url": "https://dealer-website.com/inventory",
  "useCachedPattern": true,
  "maxPages": 5
}
```

Response:
```json
{
  "success": true,
  "vehicles": [
    {
      "year": 2020,
      "make": "Toyota",
      "model": "Camry",
      "price": 25000,
      "mileage": 45000,
      "vin": "1HGBH41JXMN109186",
      "url": "https://dealer-website.com/vehicle/123",
      "image_url": "https://dealer-website.com/images/camry.jpg"
    }
  ],
  "tier": "api",
  "confidence": "high",
  "pagesScraped": 1,
  "duration": 2345
}
```

## Deployment

### Option 1: Railway (Recommended - Easiest)

See `DEPLOYMENT.md` for step-by-step Railway deployment instructions.

### Option 2: Docker Compose (Local or VPS)

```bash
docker-compose up -d
```

### Option 3: Fly.io

See `DEPLOYMENT.md` for Fly.io deployment instructions.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Request: Scrape dealer-website.com             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Check Pattern Cache (Supabase)                 │
│ → Found? Use cached selectors (FAST)           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ TIER 1: API Interception                       │
│ → Intercept JSON API calls                     │
│ → Success? Cache pattern & return              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ TIER 2: Structured Data (JSON-LD)             │
│ → Parse Schema.org markup                      │
│ → Success? Cache pattern & return              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ TIER 3: Smart Selector Discovery               │
│ → Try common selector patterns                 │
│ → Success? Cache selectors & return            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ TIER 4: LLM Vision (Claude)                    │
│ → Screenshot → Claude Vision API               │
│ → Learn selectors → Cache for next time        │
└─────────────────────────────────────────────────┘
```

## Performance

- **With cached pattern**: 1-2 seconds per scrape
- **First time (discovery)**: 5-10 seconds
- **LLM fallback**: 10-15 seconds (rare, ~5-10% of sites)

## Cost Analysis

**Monthly Costs:**
- Railway hosting: ~$10-20/month
- Claude API: ~$5-10/month (only for difficult sites, patterns cached)
- **Total: $15-30/month**

**vs Alternatives:**
- Firecrawl: $60-150/month
- Browserless: $50-200/month
- **Savings: $35-170/month = $420-2,040/year**

## Troubleshooting

### Browser won't start

Make sure Playwright browsers are installed:
```bash
npx playwright install chromium
```

### Out of memory errors

Increase Docker memory limit or add to docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 2G
```

### Pattern cache not working

Check Supabase connection and ensure migration was run:
```bash
# Test connection
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## License

MIT
