/**
 * Test script for local development
 * Run with: npm run test
 */

import 'dotenv/config';
import { RobustScraper } from './scraper.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing required environment variables. Check your .env file.');
  process.exit(1);
}

async function test() {
  console.log('🧪 Testing Playwright Scraper Service\n');

  const scraper = new RobustScraper(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY
  );

  try {
    // Test with a real dealer website
    // Replace with your test URL
    const testUrl = process.argv[2] || 'https://www.cars.com/shopping/results/?page=1&per_page=20';

    console.log(`Testing URL: ${testUrl}\n`);

    const result = await scraper.scrape({
      url: testUrl,
      useCachedPattern: true,
    });

    console.log('\n📊 RESULTS:');
    console.log('─'.repeat(50));
    console.log(`Success: ${result.success}`);
    console.log(`Tier Used: ${result.tier}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Vehicles Found: ${result.vehicles.length}`);
    console.log(`Duration: ${result.duration}ms`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    if (result.vehicles.length > 0) {
      console.log('\n📋 Sample Vehicle:');
      console.log('─'.repeat(50));
      const sample = result.vehicles[0];
      console.log(JSON.stringify(sample, null, 2));

      console.log('\n✅ TEST PASSED - Vehicles extracted successfully!');
    } else {
      console.log('\n⚠️  No vehicles found - this might be expected for some URLs');
    }

    await scraper.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error(error);
    await scraper.close();
    process.exit(1);
  }
}

test();
