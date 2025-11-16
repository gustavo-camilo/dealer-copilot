/**
 * TIER 4: LLM Vision Fallback
 * Uses Claude Vision to extract vehicle data from screenshots
 * Most robust fallback, works on ANY website structure
 */

import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { Vehicle, ExtractionResult } from './types.js';

export class LLMVisionExtractor {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Extract vehicles using Claude Vision API
   */
  async extract(page: Page, domain: string, pageUrl: string): Promise<ExtractionResult | null> {
    console.log(`🤖 Tier 4: Using Claude Vision...`);

    try {
      // Take full-page screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Convert to base64
      const base64Image = screenshot.toString('base64');

      // Call Claude Vision API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Analyze this car dealer inventory page and extract ALL vehicles shown.

For each vehicle, extract:
- year (number)
- make (string)
- model (string)
- mileage (number, miles only)
- vin (string, 17 characters)
- price (number, USD)
- image_url (if visible)
- url (if visible)

Return ONLY a valid JSON array of vehicle objects. If a field is not visible, omit it.
Example format:
[
  {
    "year": 2020,
    "make": "Toyota",
    "model": "Camry",
    "price": 25000,
    "mileage": 45000,
    "vin": "1HGBH41JXMN109186"
  }
]

Return ONLY the JSON array, no other text.`,
              },
            ],
          },
        ],
      });

      // Parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Extract JSON from response (Claude might wrap it in markdown)
      const text = content.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('❌ No JSON array found in Claude response');
        return null;
      }

      const vehicles = JSON.parse(jsonMatch[0]) as Vehicle[];

      // Add the page URL to vehicles that don't have one
      for (const vehicle of vehicles) {
        if (!vehicle.url) {
          vehicle.url = pageUrl;
        }
      }

      // Validate vehicles
      const validVehicles = vehicles.filter(
        (v) => (v.year && v.make) || v.vin
      );

      if (validVehicles.length === 0) {
        console.log('❌ No valid vehicles extracted by Claude');
        return null;
      }

      console.log(`✅ Tier 4 (LLM Vision): Extracted ${validVehicles.length} vehicles`);

      return {
        vehicles: validVehicles,
        tier: 'llm',
        confidence: 'medium',
      };
    } catch (error) {
      console.error('LLM Vision extraction failed:', error);
      return null;
    }
  }

  /**
   * Learn selector patterns from Claude's extraction
   * This allows caching patterns to avoid future LLM calls
   */
  async learnPattern(
    page: Page,
    vehicles: Vehicle[]
  ): Promise<{ container?: string; selectors?: any } | null> {
    console.log(`🧠 Attempting to learn selector pattern...`);

    try {
      // Get page HTML
      const html = await page.content();

      // Ask Claude to identify the selectors used
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Given this HTML snippet and the vehicles I extracted, what CSS selectors should I use to extract vehicle data in the future?

HTML (partial):
${html.substring(0, 10000)}

Extracted ${vehicles.length} vehicles.

Return a JSON object with:
{
  "container": "CSS selector for vehicle card containers",
  "year": "CSS selector for year within container",
  "make": "CSS selector for make within container",
  "model": "CSS selector for model within container",
  "price": "CSS selector for price within container"
}

Return ONLY the JSON object, no other text.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return null;
      }

      // Extract JSON
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const selectors = JSON.parse(jsonMatch[0]);
      console.log(`✅ Learned pattern:`, selectors);

      return selectors;
    } catch (error) {
      console.error('Failed to learn pattern:', error);
      return null;
    }
  }
}
