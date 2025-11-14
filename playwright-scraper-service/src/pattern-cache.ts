/**
 * Domain Pattern Cache
 * Stores successful extraction patterns in Supabase to avoid re-discovery
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DomainPattern } from './types.js';

export class PatternCache {
  private supabase: SupabaseClient;
  private memoryCache: Map<string, DomainPattern> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get cached pattern for a domain
   */
  async get(domain: string): Promise<DomainPattern | null> {
    // Check memory cache first
    if (this.memoryCache.has(domain)) {
      const pattern = this.memoryCache.get(domain)!;
      console.log(`📦 Found pattern in memory cache for ${domain} (Tier ${pattern.tier})`);
      return pattern;
    }

    // Check database
    try {
      const { data, error } = await this.supabase
        .from('scraper_domain_patterns')
        .select('*')
        .eq('domain', domain)
        .single();

      if (error || !data) {
        return null;
      }

      const pattern: DomainPattern = {
        domain: data.domain,
        tier: data.tier,
        config: data.config,
        lastUsed: new Date(data.last_used),
        successRate: data.success_rate,
      };

      // Store in memory cache
      this.memoryCache.set(domain, pattern);

      console.log(`📦 Found pattern in database for ${domain} (Tier ${pattern.tier})`);

      return pattern;
    } catch (error) {
      console.error('Failed to get pattern from cache:', error);
      return null;
    }
  }

  /**
   * Save pattern to cache
   */
  async save(pattern: DomainPattern): Promise<void> {
    try {
      // Update memory cache
      this.memoryCache.set(pattern.domain, pattern);

      // Update database
      await this.supabase.from('scraper_domain_patterns').upsert(
        {
          domain: pattern.domain,
          tier: pattern.tier,
          config: pattern.config,
          last_used: pattern.lastUsed.toISOString(),
          success_rate: pattern.successRate,
        },
        {
          onConflict: 'domain',
        }
      );

      console.log(`💾 Saved pattern for ${pattern.domain} (Tier ${pattern.tier})`);
    } catch (error) {
      console.error('Failed to save pattern to cache:', error);
    }
  }

  /**
   * Update success rate for a pattern
   */
  async updateSuccessRate(domain: string, success: boolean): Promise<void> {
    try {
      const pattern = await this.get(domain);
      if (!pattern) return;

      // Calculate new success rate (exponential moving average)
      const alpha = 0.2; // Weight for new observation
      const newRate = success
        ? pattern.successRate + alpha * (1 - pattern.successRate)
        : pattern.successRate * (1 - alpha);

      pattern.successRate = newRate;
      pattern.lastUsed = new Date();

      await this.save(pattern);
    } catch (error) {
      console.error('Failed to update success rate:', error);
    }
  }

  /**
   * Clear patterns with low success rates
   */
  async clearFailedPatterns(threshold: number = 0.3): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('scraper_domain_patterns')
        .delete()
        .lt('success_rate', threshold);

      if (error) throw error;

      // Clear memory cache
      for (const [domain, pattern] of this.memoryCache.entries()) {
        if (pattern.successRate < threshold) {
          this.memoryCache.delete(domain);
        }
      }

      console.log(`🧹 Cleared patterns with success rate < ${threshold}`);
    } catch (error) {
      console.error('Failed to clear failed patterns:', error);
    }
  }
}
