/**
 * Express Server for Playwright Scraper Service
 */

import express from 'express';
import { RobustScraper } from './scraper.js';
import { ScrapeRequest } from './types.js';

const app = express();
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize scraper
const scraper = new RobustScraper(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY
);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthy = await scraper.healthCheck();
    res.json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Scrape endpoint
app.post('/scrape', async (req, res) => {
  try {
    const request: ScrapeRequest = req.body;

    // Validate request
    if (!request.url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: url',
      });
    }

    // Perform scraping
    console.log(`\n📨 Received scrape request: ${request.url}`);
    const result = await scraper.scrape(request);

    res.json(result);
  } catch (error: any) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      vehicles: [],
      tier: 'none',
      confidence: 'low',
      pagesScraped: 0,
      duration: 0,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  await scraper.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  await scraper.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Playwright Scraper Service`);
  console.log(`   Running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Scrape endpoint: POST http://localhost:${PORT}/scrape`);
  console.log(`\n✅ Ready to accept requests\n`);
});
