# Web Scraping Research & Future Options

**Document Purpose:** Research findings on web scraping technologies and strategies for scaling the dealer inventory scraper.

**Last Updated:** 2025-01-13
**Status:** Current solution implemented and working. This document is for future reference.

---

## Table of Contents
1. [Current Solution](#current-solution)
2. [Technology Comparison](#technology-comparison)
3. [Pricing Analysis](#pricing-analysis)
4. [When to Upgrade](#when-to-upgrade)
5. [Implementation Guides](#implementation-guides)
6. [Decision Framework](#decision-framework)

---

## Current Solution

### ✅ What We Have Now

**Technology Stack:**
- Deno/TypeScript running in Supabase Edge Functions
- Static HTML scraping with multiple fallback strategies
- No external dependencies, zero cost

**Core Modules:**
1. **sitemapParser.ts** - XML sitemap discovery and parsing
2. **fetcher.ts** - Robust HTTP client with retry logic and rate limiting
3. **metadataExtractor.ts** - Multi-source metadata extraction (Open Graph, Twitter Cards)
4. **parser.ts** - HTML parsing with vehicle card detection
5. **dateExtractor.ts** - Listing date extraction from multiple sources
6. **vinDecoder.ts** - VIN validation and decoding

**Scraping Flow:**
```
1. Sitemap Discovery (BEST)
   ├─ Check robots.txt
   ├─ Try common sitemap paths
   ├─ Parse XML and filter vehicle URLs
   ├─ Batch fetch with retry + rate limiting
   └─ Parse HTML or extract metadata

2. Traditional Scraping (FALLBACK)
   ├─ Find inventory pages
   ├─ Robust fetch with exponential backoff
   ├─ Parse with validation
   └─ Deduplicate by URL

3. Enhancement
   ├─ Fetch detail pages with retry
   ├─ Parse or extract metadata
   ├─ Validate matches before merging
   └─ VIN decoder as final fallback
```

**Key Features:**
- ✅ Exponential backoff retry (handles temporary failures)
- ✅ Rate limiting (1 req/sec per domain - respectful)
- ✅ 404 detection (no more error pages as vehicles)
- ✅ Stable identifiers (no duplicate vehicles)
- ✅ Multi-source extraction (works on more site types)
- ✅ Sitemap-first strategy (most complete discovery)

**Expected Success Rate:**
- Static sites: 90-95%
- Sites with sitemaps: 95%+
- Sites with good meta tags: 85-90%
- JavaScript-heavy sites: 30-40%

**Cost:** $0/month

---

## Technology Comparison

### 1. Playwright (Headless Browser)

**What It Is:** Microsoft's modern browser automation framework

**Pros:**
- ✅ Handles JavaScript/React/Vue sites (full browser rendering)
- ✅ Cross-browser support (Chrome, Firefox, Safari)
- ✅ Multi-language support (TypeScript, Python, Java, .NET)
- ✅ Interactive capabilities (click, scroll, wait)
- ✅ Open source, no per-request cost
- ✅ Reliable for modern web apps

**Cons:**
- ❌ Resource-heavy (100MB+ memory per instance)
- ❌ Slow (2-5 seconds per page)
- ❌ Can't run in Supabase Edge Functions (needs dedicated server)
- ❌ Websites can detect headless browsers

**Cost:**
- VPS: $5-20/month (DigitalOcean, Hetzner)
- Browserless.io: $30/month (managed service)

**When to Use:**
- JavaScript-heavy dealer sites (React, Vue, Angular)
- Sites that require interaction (click "Show More", etc.)
- Current scraper success rate < 70%

**Implementation Time:** 1-2 days

---

### 2. Scrapy (Python Framework)

**What It Is:** Purpose-built Python framework for large-scale web scraping

**Pros:**
- ✅ Purpose-built for scraping
- ✅ Excellent documentation, mature ecosystem
- ✅ Built-in middleware for proxies, user agents
- ✅ Efficient concurrency
- ✅ Great for large-scale operations (1000+ sites)

**Cons:**
- ❌ Python-only (different stack from Deno/TypeScript)
- ❌ Can't handle JavaScript without Playwright integration
- ❌ Requires separate infrastructure
- ❌ Steeper learning curve

**Cost:**
- VPS: $10-50/month (depending on scale)

**When to Use:**
- Scaling to 1000+ dealers
- Team has Python expertise
- Need sophisticated crawling rules

**Implementation Time:** 1-2 weeks

---

### 3. Puppeteer (Chrome Automation)

**What It Is:** Google's headless Chrome automation library

**Pros:**
- ✅ Excellent JavaScript handling
- ✅ Native Chrome integration
- ✅ Good stealth capabilities
- ✅ Large community and resources

**Cons:**
- ❌ Chrome-only (limited browser support)
- ❌ JavaScript/Node.js only
- ❌ Resource-heavy like Playwright
- ❌ Can't run in Edge Functions

**Cost:**
- VPS: $5-20/month
- Browserless.io: $30/month

**When to Use:**
- Chrome-only scraping is sufficient
- Team familiar with Puppeteer
- Need stealth capabilities

**Implementation Time:** 1-2 days

---

### 4. Firecrawl (AI-Powered SaaS)

**What It Is:** Managed web scraping API with AI-powered extraction

**Pros:**
- ✅ Handles JavaScript-heavy sites automatically
- ✅ Schema-based extraction (tell it what you want)
- ✅ Built-in anti-bot evasion
- ✅ Proxy rotation included
- ✅ LLM-ready output (Markdown/JSON)
- ✅ Zero infrastructure needed
- ✅ Fast (<1 second per page)
- ✅ 96% web coverage claimed

**Cons:**
- ❌ Expensive ($83-333/month for typical usage)
- ❌ External API dependency
- ❌ Less control over extraction logic
- ❌ Third-party sees your scraping targets
- ❌ Per-page pricing can add up

**Pricing:**
| Plan | Cost | Credits | Best For |
|------|------|---------|----------|
| Free | $0 | 500 | Testing |
| Hobby | $16/mo | 3,000 | <10 dealers |
| Standard | $83/mo | 100,000 | 10-50 dealers |
| Growth | $333/mo | 500,000 | 50-200 dealers |
| Enterprise | Custom | Unlimited | 200+ dealers |

**Credit Usage:** 1 credit = 1 page scraped

**When to Use:**
- Need 99% success rate immediately
- Developer time > $83/month
- Heavy JavaScript sites (70%+ of dealers)
- Quick launch requirement (hours, not days)
- Budget allows $83-333/month

**Implementation Time:** 2-4 hours

---

### 5. Jina AI Reader (AI-Powered Free Tier)

**What It Is:** Free AI-powered web content extraction

**Pros:**
- ✅ FREE up to 1M tokens (~10,000 pages/month)
- ✅ No API key required
- ✅ Simple URL-to-Markdown conversion
- ✅ Good for prototyping

**Cons:**
- ❌ No crawling capabilities
- ❌ JavaScript sites may not work reliably
- ❌ Rate limits (requests per minute)
- ❌ Less reliable than Firecrawl

**Cost:** Free (1M tokens/month)

**When to Use:**
- Testing AI extraction on specific problem sites
- Budget is $0
- Low-volume needs (<1000 pages/month)

**Implementation Time:** 1-2 hours

---

### 6. n8n + Playwright/Puppeteer

**What It Is:** Visual workflow automation with browser nodes

**Pros:**
- ✅ Visual workflow builder (non-technical friendly)
- ✅ Can chain with AI (OpenAI structured extraction)
- ✅ Scheduled runs, error notifications
- ✅ Easy to modify without code changes

**Cons:**
- ❌ Adds another system to maintain
- ❌ Still needs server for browser automation
- ❌ Learning curve for n8n

**Cost:**
- n8n Cloud: $20-50/month
- Self-hosted: $10-20/month (VPS)

**When to Use:**
- Non-technical team needs to manage scraping
- Want visual debugging
- Complex workflows with multiple steps

**Implementation Time:** 3-5 days

---

## Pricing Analysis

### Scenario 1: Small Operation (10 Dealers)
**Assumptions:** 10 dealers × 30 vehicles × 30 days = 9,000 page requests/month

| Solution | Monthly Cost | Setup Time | Success Rate |
|----------|--------------|------------|--------------|
| **Current (Enhanced)** | **$0** | Done | 85-90% |
| Firecrawl Standard | $83 | 2 hours | 95-99% |
| Playwright VPS | $10 | 2 days | 90-95% |
| Browserless.io | $30 | 4 hours | 90-95% |
| Jina AI | $0 | 2 hours | 70-80% |

**Recommendation:** Stick with current solution

---

### Scenario 2: Medium Operation (50 Dealers)
**Assumptions:** 50 dealers × 50 vehicles × 30 days = 75,000 page requests/month

| Solution | Monthly Cost | Setup Time | Success Rate |
|----------|--------------|------------|--------------|
| **Current (Enhanced)** | **$0** | Done | 85-90% |
| Firecrawl Standard | $83 | 2 hours | 95-99% |
| Playwright VPS | $20 | 2 days | 90-95% |
| Browserless.io | $30 | 4 hours | 90-95% |

**Recommendation:** Try current solution first, add Playwright if <80% success

---

### Scenario 3: Large Operation (200 Dealers)
**Assumptions:** 200 dealers × 50 vehicles × 30 days = 300,000 page requests/month

| Solution | Monthly Cost | Setup Time | Success Rate |
|----------|--------------|------------|--------------|
| Current (Enhanced) | $0 | Done | 85-90% |
| **Firecrawl Growth** | **$333** | 2 hours | 95-99% |
| **Playwright VPS** | **$50** | 3 days | 90-95% |
| Scrapy + Playwright | $100 | 2 weeks | 95% |

**Recommendation:** Playwright VPS for cost efficiency at scale

---

## When to Upgrade

### Triggers to Consider Upgrading:

**Success Rate:**
- Current success rate < 70% → Add Playwright
- Current success rate < 50% → Consider Firecrawl
- Specific problem dealers → Hybrid approach (current + Firecrawl fallback)

**Scale:**
- < 20 dealers → Current solution sufficient
- 20-100 dealers → Monitor success rate, upgrade if needed
- 100-500 dealers → Consider Playwright VPS
- 500+ dealers → Scrapy + Playwright or Firecrawl Enterprise

**Budget:**
- $0 budget → Current solution only
- $10-50/month → Playwright VPS or selective Firecrawl
- $100+/month → Firecrawl Standard/Growth for reliability

**Developer Time:**
- 1 hour/week available → Stick with current
- 5+ hours/week fixing scrapers → Upgrade to reduce maintenance
- Developer hourly rate > $80 → Firecrawl may be cheaper than dev time

**Requirements:**
- Need JavaScript rendering → Playwright or Firecrawl
- Need 99% reliability → Firecrawl
- Need full control → Playwright
- Need fast implementation → Firecrawl
- Data privacy critical → Playwright (self-hosted)

---

## Implementation Guides

### Option A: Add Playwright (Local Fallback)

**When:** Success rate 70-85%, JavaScript sites causing issues

**Cost:** $10-30/month (VPS or Browserless.io)

**Implementation Steps:**
1. Set up VPS or Browserless.io account
2. Create Playwright scraping service
3. Add HTTP endpoint to call from Edge Function
4. Update scraper to try Playwright as fallback
5. Track which sites use Playwright (for cost monitoring)

**Estimated Time:** 1-2 days

**Code Architecture:**
```typescript
// In main scraper
if (currentScraperFails) {
  const result = await callPlaywrightService(url);
}
```

---

### Option B: Add Firecrawl (Selective)

**When:** Need quick reliability boost, budget allows $16-83/month

**Cost:** $16-83/month

**Implementation Steps:**
1. Sign up for Firecrawl account
2. Get API key
3. Add Firecrawl module (already created, just enable)
4. Configure allowlist of problem dealers
5. Track usage and costs

**Estimated Time:** 2-4 hours

**Code Architecture:**
```typescript
// Only use Firecrawl for allowlisted sites
const FIRECRAWL_ALLOWLIST = ['problem-dealer1.com', 'problem-dealer2.com'];

if (FIRECRAWL_ALLOWLIST.includes(dealer.domain)) {
  const result = await firecrawl.scrape(url);
}
```

---

### Option C: Full Playwright Migration

**When:** Success rate < 60%, scaling to 100+ dealers

**Cost:** $20-100/month (depending on scale)

**Implementation Steps:**
1. Set up Playwright infrastructure
2. Migrate current parsers to Playwright
3. Add stealth plugins (puppeteer-extra-plugin-stealth)
4. Implement proxy rotation (optional)
5. Deploy and monitor

**Estimated Time:** 1-2 weeks

---

### Option D: Hybrid Approach (Recommended for Future)

**When:** Want to optimize cost/performance

**Cost:** $0-50/month (depending on fallback usage)

**Strategy:**
1. Try current scraper first (free, fast)
2. If fails → Try Playwright (moderate cost)
3. If still fails → Try Firecrawl (higher cost, highest success)

**Implementation Steps:**
1. Keep current scraper as primary
2. Add Playwright as secondary (for JS sites)
3. Add Firecrawl as tertiary (for maximum reliability)
4. Track which sites use which method
5. Optimize based on success rates and costs

**Estimated Time:** 3-5 days

---

## Decision Framework

### Quick Decision Tree:

```
Start: Do you need to scrape JavaScript-heavy sites?
├─ NO → Current solution (0% cost)
│
└─ YES → What's your budget?
    ├─ $0/month → Current solution + manual handling of failures
    │
    ├─ $10-30/month → Playwright VPS fallback
    │
    └─ $80+/month → Firecrawl (fastest implementation, highest success rate)
```

### Detailed Decision Matrix:

| Situation | Recommendation | Cost | Why |
|-----------|---------------|------|-----|
| Starting out, < 20 dealers | Current solution | $0 | Prove product-market fit first |
| 90%+ success rate | Current solution | $0 | Don't fix what works |
| 70-90% success rate | Monitor, upgrade if needed | $0-30 | Add Playwright selectively |
| < 70% success rate | Add Playwright or Firecrawl | $30-83 | Need reliability boost |
| Heavy JavaScript sites | Playwright or Firecrawl | $30-83 | Current can't handle |
| Need 99% reliability | Firecrawl | $83-333 | Best success rate |
| 100+ dealers | Playwright VPS | $50-100 | Cost-effective at scale |
| Developer time expensive | Firecrawl | $83-333 | Reduce maintenance |
| Data privacy critical | Playwright (self-hosted) | $20-50 | Full control |

---

## Platform-Specific Success Rates

### Current Solution Expected Performance:

| Dealer Platform | Technology | Expected Success Rate | Should Upgrade? |
|----------------|------------|---------------------|----------------|
| DealerCenter | Server-side rendered | 95% | ❌ No |
| CarGurus widgets | JSON-LD + HTML | 90% | ❌ No |
| Cars.com feeds | Static HTML | 85% | ❌ No |
| WordPress + Plugins | Mixed | 80% | ⚠️ Monitor |
| Custom Shopify | JavaScript-heavy | 60% | ⚠️ Consider Playwright |
| React/Vue SPAs | Client-side only | 30% | ✅ Yes - Playwright/Firecrawl |
| Protected sites | Anti-bot measures | 20% | ✅ Yes - Firecrawl |

---

## Testing & Monitoring

### Key Metrics to Track:

1. **Success Rate by Dealer:**
   - Track which dealers consistently fail
   - Identify platform patterns

2. **Scraping Duration:**
   - Monitor slow dealers
   - Identify timeout issues

3. **Data Completeness:**
   - % of vehicles with VINs
   - % with all core fields (year, make, model, price)

4. **Error Types:**
   - Network failures (should decrease with retry logic)
   - Parsing failures (may need Playwright)
   - 404s (should be eliminated with validation)

### Success Rate Thresholds:

- **95%+** → Excellent, stay with current
- **85-95%** → Good, monitor trends
- **70-85%** → Acceptable, plan upgrade
- **< 70%** → Upgrade recommended

---

## Cost Projections

### 3-Year Total Cost of Ownership:

**Scenario: 50 dealers, 2,500 vehicles**

| Solution | Setup | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|-------|--------|--------|--------|--------------|
| **Current** | $0 | $0 | $0 | $0 | **$0** |
| Playwright VPS | $0 | $240 | $240 | $240 | **$720** |
| Browserless.io | $0 | $360 | $360 | $360 | **$1,080** |
| Firecrawl Standard | $0 | $996 | $996 | $996 | **$2,988** |
| Firecrawl Growth | $0 | $3,996 | $3,996 | $3,996 | **$11,988** |

**Break-Even Analysis:**
- If fixing scraper issues costs >2 hours/month @ $50/hr
- Then Firecrawl Standard ($83/mo) is cheaper than developer time

---

## Best Practices (Regardless of Solution)

### Always Do:
1. ✅ Implement rate limiting (be respectful)
2. ✅ Honor robots.txt
3. ✅ Use proper User-Agent headers
4. ✅ Cache results when possible
5. ✅ Retry with exponential backoff
6. ✅ Validate extracted data
7. ✅ Log failures for debugging
8. ✅ Monitor success rates

### Never Do:
1. ❌ Scrape faster than 1 request/second per domain
2. ❌ Ignore 429 (rate limit) responses
3. ❌ Skip error handling
4. ❌ Store unvalidated data
5. ❌ Scrape protected content without permission
6. ❌ Use scraped data for competitors

---

## Summary

### Current State:
- **Have:** Robust, multi-strategy scraper ($0/month)
- **Expected Success:** 85-90% of dealer sites
- **Status:** Ready to test in production

### Future Options (When Needed):
1. **Playwright** - Best for JS sites, cost-effective at scale ($10-50/mo)
2. **Firecrawl** - Best for quick reliability, highest success rate ($83-333/mo)
3. **Hybrid** - Best of both worlds, optimize cost/performance

### Recommendation:
1. **Test current solution for 2-4 weeks**
2. **Track success rates by dealer platform**
3. **Upgrade selectively based on data:**
   - If 85%+ success → Stay with current ($0/mo savings)
   - If 70-85% success → Add Playwright fallback ($10-30/mo)
   - If < 70% success → Consider Firecrawl ($83+/mo)

### ROI Decision Point:
**Upgrade when: (Developer time to fix scrapers) > (Cost of automated solution)**

Example: If you spend 2+ hours/month fixing scrapers, and your time is worth $50+/hour, then Firecrawl Standard ($83/mo) or Playwright ($20-30/mo) pays for itself.

---

## Resources

### Documentation:
- Playwright: https://playwright.dev/
- Firecrawl: https://www.firecrawl.dev/
- Scrapy: https://scrapy.org/
- Puppeteer: https://pptr.dev/
- Jina AI: https://jina.ai/reader/

### Cost Calculators:
- Firecrawl Pricing: https://www.firecrawl.dev/pricing
- Browserless Pricing: https://browserless.io/pricing

### Community:
- Playwright Discord: https://aka.ms/playwright/discord
- Web Scraping Subreddit: r/webscraping

---

**Document Maintenance:**
- Update this document when testing new solutions
- Track actual success rates vs. predictions
- Adjust recommendations based on real-world data
- Review quarterly as the dealer portfolio grows

---

**Last Review:** 2025-01-13
**Next Review:** 2025-04-13 (or when scaling to 50+ dealers)
