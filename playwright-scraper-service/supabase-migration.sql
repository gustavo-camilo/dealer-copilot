-- Migration: Create scraper_domain_patterns table
-- This table caches successful extraction patterns to avoid re-discovery

CREATE TABLE IF NOT EXISTS scraper_domain_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL CHECK (tier IN ('api', 'structured', 'selector')),
    config JSONB NOT NULL,
    last_used TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success_rate FLOAT NOT NULL DEFAULT 1.0 CHECK (success_rate >= 0 AND success_rate <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scraper_domain_patterns_domain ON scraper_domain_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_scraper_domain_patterns_last_used ON scraper_domain_patterns(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_domain_patterns_success_rate ON scraper_domain_patterns(success_rate DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scraper_domain_patterns_updated_at
    BEFORE UPDATE ON scraper_domain_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE scraper_domain_patterns IS 'Caches successful extraction patterns for dealer websites to improve scraping efficiency';
