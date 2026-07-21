-- 1. Create event_store table
CREATE TABLE IF NOT EXISTS event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying events by aggregate_id quickly
CREATE INDEX IF NOT EXISTS event_store_aggregate_id_idx ON event_store(aggregate_id);
-- Index for querying events chronologically
CREATE INDEX IF NOT EXISTS event_store_created_at_idx ON event_store(created_at);

-- 2. Create the generic trigger function
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_event_type TEXT;
  v_payload JSONB;
  v_aggregate_id UUID;
BEGIN
  -- Attempt to get the user ID from Supabase Auth context
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_aggregate_id := (row_to_json(NEW)->>'id')::UUID;
    v_event_type := TG_TABLE_NAME || '_CREATED';
    v_payload := jsonb_build_object('new', row_to_json(NEW), 'user_id', v_user_id);
    INSERT INTO event_store (aggregate_id, event_type, payload, created_at)
    VALUES (v_aggregate_id, v_event_type, v_payload, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_aggregate_id := (row_to_json(NEW)->>'id')::UUID;
    v_event_type := TG_TABLE_NAME || '_UPDATED';
    v_payload := jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW), 'user_id', v_user_id);
    INSERT INTO event_store (aggregate_id, event_type, payload, created_at)
    VALUES (v_aggregate_id, v_event_type, v_payload, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_aggregate_id := (row_to_json(OLD)->>'id')::UUID;
    v_event_type := TG_TABLE_NAME || '_DELETED';
    v_payload := jsonb_build_object('old', row_to_json(OLD), 'user_id', v_user_id);
    INSERT INTO event_store (aggregate_id, event_type, payload, created_at)
    VALUES (v_aggregate_id, v_event_type, v_payload, NOW());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply triggers to critical tables

-- profiles
DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE audit_log_trigger();

-- clubs
DROP TRIGGER IF EXISTS audit_clubs_trigger ON clubs;
CREATE TRIGGER audit_clubs_trigger
  AFTER INSERT OR UPDATE OR DELETE ON clubs
  FOR EACH ROW EXECUTE PROCEDURE audit_log_trigger();

-- events
DROP TRIGGER IF EXISTS audit_events_trigger ON events;
CREATE TRIGGER audit_events_trigger
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE PROCEDURE audit_log_trigger();

-- 4. Create Materialized View for state projection
-- This view projects the latest non-deleted state for all aggregates.
DROP MATERIALIZED VIEW IF EXISTS current_state_projection;
CREATE MATERIALIZED VIEW current_state_projection AS
WITH ranked_events AS (
  SELECT 
    aggregate_id,
    event_type,
    payload,
    created_at,
    ROW_NUMBER() OVER(PARTITION BY aggregate_id ORDER BY created_at DESC) as rn
  FROM event_store
)
SELECT 
  aggregate_id,
  event_type as last_event_type,
  payload as last_payload,
  created_at as last_updated_at
FROM ranked_events
WHERE rn = 1 AND event_type NOT LIKE '%_DELETED';

-- Create a unique index to allow concurrent refreshes (if needed later)
CREATE UNIQUE INDEX IF NOT EXISTS current_state_projection_aggregate_id_idx ON current_state_projection(aggregate_id);

-- 5. RLS for event_store
ALTER TABLE event_store ENABLE ROW LEVEL SECURITY;

-- Add a basic policy to resolve the "table has RLS enabled but no policies" warning
-- Only service role can access these logs directly
CREATE POLICY "Service role can manage event_store" ON event_store
  FOR ALL
  USING (auth.role() = 'service_role');
