-- Function to normalize URLs to bare domains
CREATE OR REPLACE FUNCTION normalize_url_to_domain(p_url TEXT)
RETURNS TEXT AS $$
DECLARE
    v_url TEXT;
BEGIN
    IF p_url IS NULL OR p_url = '' THEN
        RETURN p_url;
    END IF;

    -- 1. Strip protocol (http:// or https://)
    v_url := REGEXP_REPLACE(p_url, '^https?://', '', 'i');
    
    -- 2. Strip 'www.'
    v_url := REGEXP_REPLACE(v_url, '^www\.', '', 'i');
    
    -- 3. Strip trailing slashes and paths (common if user pastes full URL)
    -- We only want the domain part
    v_url := SPLIT_PART(v_url, '/', 1);
    
    -- 4. Final trim and lowercase
    RETURN LOWER(TRIM(v_url));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function for source_registry
CREATE OR REPLACE FUNCTION trg_normalize_source_url()
RETURNS TRIGGER AS $$
BEGIN
    NEW.source_url := normalize_url_to_domain(NEW.source_url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to source_registry
DROP TRIGGER IF EXISTS enforce_domain_standard_source ON source_registry;
CREATE TRIGGER enforce_domain_standard_source
    BEFORE INSERT OR UPDATE OF source_url
    ON source_registry
    FOR EACH ROW
    EXECUTE FUNCTION trg_normalize_source_url();

-- Trigger function for tenants
CREATE OR REPLACE FUNCTION trg_normalize_tenant_website()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.website_url IS NOT NULL THEN
        NEW.website_url := normalize_url_to_domain(NEW.website_url);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tenants
DROP TRIGGER IF EXISTS enforce_domain_standard_tenant ON tenants;
CREATE TRIGGER enforce_domain_standard_tenant
    BEFORE INSERT OR UPDATE OF website_url
    ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION trg_normalize_tenant_website();
