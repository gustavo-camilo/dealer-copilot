#!/usr/bin/env node

/**
 * Diagnostic script to test both Python and Playwright scraper services
 * This will help identify which scraper is failing and why
 */

const PYTHON_SCRAPER_URL = 'https://python-scraper-b7g4h.ondigitalocean.app';
const PLAYWRIGHT_SERVICE_URL = 'https://squid-app-vew3y.ondigitalocean.app';

// Test URLs - common dealer websites
const TEST_URLS = [
  'https://www.carmax.com/cars/all', // Known to work with most scrapers
];

async function testPythonScraper(url) {
  const startTime = Date.now();

  try {
    console.log(`\n🐍 Testing Python Scraper with: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(`${PYTHON_SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      service: 'python',
      url,
      success: result.success && result.vehicles?.length > 0,
      vehiclesFound: result.vehicles?.length || 0,
      tier: result.tier,
      confidence: result.confidence,
      duration,
      error: result.success ? undefined : result.error,
    };
  } catch (error) {
    return {
      service: 'python',
      url,
      success: false,
      vehiclesFound: 0,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testPlaywrightScraper(url) {
  const startTime = Date.now();

  try {
    console.log(`\n🎭 Testing Playwright Scraper with: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(`${PLAYWRIGHT_SERVICE_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        useCachedPattern: true,
        maxPages: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      service: 'playwright',
      url,
      success: result.success && result.vehicles?.length > 0,
      vehiclesFound: result.vehicles?.length || 0,
      tier: result.tier,
      confidence: result.confidence,
      duration,
      error: result.success ? undefined : result.error,
    };
  } catch (error) {
    return {
      service: 'playwright',
      url,
      success: false,
      vehiclesFound: 0,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testHealthEndpoints() {
  console.log('\n=== HEALTH CHECK ===\n');

  try {
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 5000);
    const pythonHealth = await fetch(`${PYTHON_SCRAPER_URL}/health`, {
      signal: controller1.signal,
    });
    clearTimeout(timeout1);
    console.log(`✅ Python Scraper Health: ${pythonHealth.status} ${pythonHealth.statusText}`);
  } catch (error) {
    console.log(`❌ Python Scraper Health: ${error.message}`);
  }

  try {
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 5000);
    const playwrightHealth = await fetch(`${PLAYWRIGHT_SERVICE_URL}/health`, {
      signal: controller2.signal,
    });
    clearTimeout(timeout2);
    console.log(`✅ Playwright Scraper Health: ${playwrightHealth.status} ${playwrightHealth.statusText}`);
  } catch (error) {
    console.log(`❌ Playwright Scraper Health: ${error.message}`);
  }
}

function printResults(results) {
  console.log('\n=== TEST RESULTS ===\n');

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const service = result.service === 'python' ? 'Python' : 'Playwright';

    console.log(`${icon} ${service} - ${result.url}`);
    console.log(`   Vehicles Found: ${result.vehiclesFound}`);

    if (result.tier) {
      console.log(`   Tier: ${result.tier} (${result.confidence} confidence)`);
    }

    if (result.duration) {
      console.log(`   Duration: ${result.duration}ms`);
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    console.log('');
  }

  // Summary
  const pythonResults = results.filter(r => r.service === 'python');
  const playwrightResults = results.filter(r => r.service === 'playwright');

  const pythonSuccessRate = pythonResults.filter(r => r.success).length / pythonResults.length * 100;
  const playwrightSuccessRate = playwrightResults.filter(r => r.success).length / playwrightResults.length * 100;

  console.log('=== SUMMARY ===\n');
  console.log(`Python Scraper Success Rate: ${pythonSuccessRate.toFixed(0)}% (${pythonResults.filter(r => r.success).length}/${pythonResults.length})`);
  console.log(`Playwright Scraper Success Rate: ${playwrightSuccessRate.toFixed(0)}% (${playwrightResults.filter(r => r.success).length}/${playwrightResults.length})`);

  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===\n');

  if (pythonSuccessRate === 0 && playwrightSuccessRate === 0) {
    console.log('❌ CRITICAL: Both scrapers are failing!');
    console.log('   - Check if services are deployed and running');
    console.log('   - Check Supabase secrets (PYTHON_SCRAPER_URL, PLAYWRIGHT_SERVICE_URL)');
    console.log('   - Check DigitalOcean app logs for errors');
  } else if (pythonSuccessRate === 0) {
    console.log('⚠️  Python scraper is not working');
    console.log('   - Consider disabling Python scraper to save costs');
    console.log('   - Playwright is working and can be used as primary');
  } else if (playwrightSuccessRate === 0) {
    console.log('⚠️  Playwright scraper is not working');
    console.log('   - Consider disabling Playwright scraper to save costs');
    console.log('   - Python is working and can be used as primary');
  } else if (pythonSuccessRate === 100 && playwrightSuccessRate === 100) {
    console.log('✅ Both scrapers are working perfectly!');
    console.log('   - Consider keeping only Python (better bot detection)');
    console.log('   - Disable Playwright to save ~$12/month');
  } else {
    console.log('⚠️  Mixed results - some scrapers working on some sites');
    console.log('   - Keep both scrapers for redundancy');
    console.log('   - Monitor which one works better over time');
  }
}

// Main execution
async function main() {
  console.log('🔍 Dealer Co-Pilot Scraper Diagnostic Tool\n');
  console.log(`Testing URLs:`);
  TEST_URLS.forEach(url => console.log(`  - ${url}`));

  await testHealthEndpoints();

  const results = [];

  // Test each URL with both scrapers
  for (const url of TEST_URLS) {
    results.push(await testPythonScraper(url));
    results.push(await testPlaywrightScraper(url));
  }

  printResults(results);
}

main();
