-- Create RPC for requesting source scans securely
CREATE OR REPLACE FUNCTION request_source_scan(p_source_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Check if tenant has link to this source
    IF EXISTS (
        SELECT 1 FROM tenant_sources 
        WHERE source_id = p_source_id 
        AND tenant_id = (SELECT auth.uid()::uuid)
    ) THEN
        UPDATE source_registry
        SET next_scheduled_scrape = NOW(),
            status = 'pending'
        WHERE id = p_source_id;
    ELSE
        RAISE EXCEPTION 'Not authorized to request scan for this source';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
