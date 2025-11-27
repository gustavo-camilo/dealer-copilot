-- Migration file: 20251126000003_create_migration_functions.sql

-- Function to migrate a competitor to a tenant
CREATE OR REPLACE FUNCTION migrate_competitor_to_tenant(
  p_competitor_url TEXT,
  p_tenant_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_vehicles_migrated INTEGER;
  v_snapshots_migrated INTEGER;
BEGIN
  -- Update source_registry
  UPDATE source_registry
  SET 
    source_type = 'dealer',
    tenant_id = p_tenant_id,
    migrated_from_competitor_at = NOW(),
    original_competitor_url = source_url
  WHERE source_url = p_competitor_url;
  
  -- Transfer vehicle ownership
  UPDATE tracked_vehicles
  SET 
    tenant_id = p_tenant_id,
    source_type = 'dealer'
  WHERE 
    source_url = p_competitor_url 
    AND tenant_id IS NULL;
  
  GET DIAGNOSTICS v_vehicles_migrated = ROW_COUNT;
  
  -- Transfer snapshot ownership
  UPDATE inventory_snapshots_unified
  SET 
    tenant_id = p_tenant_id,
    source_type = 'dealer'
  WHERE 
    source_url = p_competitor_url 
    AND tenant_id IS NULL;
  
  GET DIAGNOSTICS v_snapshots_migrated = ROW_COUNT;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'vehicles_migrated', v_vehicles_migrated,
    'snapshots_migrated', v_snapshots_migrated,
    'migrated_at', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to demote a tenant to a competitor (Reverse migration)
CREATE OR REPLACE FUNCTION demote_tenant_to_competitor(
  p_tenant_id UUID,
  p_source_url TEXT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_vehicles_demoted INTEGER;
  v_snapshots_demoted INTEGER;
BEGIN
  -- Update source_registry
  UPDATE source_registry
  SET 
    source_type = 'competitor',
    tenant_id = NULL
  WHERE tenant_id = p_tenant_id AND source_url = p_source_url;
  
  -- Transfer vehicle ownership
  UPDATE tracked_vehicles
  SET 
    tenant_id = NULL,
    source_type = 'competitor'
  WHERE 
    tenant_id = p_tenant_id 
    AND source_url = p_source_url;
    
  GET DIAGNOSTICS v_vehicles_demoted = ROW_COUNT;
  
  -- Transfer snapshot ownership
  UPDATE inventory_snapshots_unified
  SET 
    tenant_id = NULL,
    source_type = 'competitor'
  WHERE 
    tenant_id = p_tenant_id 
    AND source_url = p_source_url;
    
  GET DIAGNOSTICS v_snapshots_demoted = ROW_COUNT;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'vehicles_demoted', v_vehicles_demoted,
    'snapshots_demoted', v_snapshots_demoted,
    'demoted_at', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
