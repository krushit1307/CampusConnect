-- Add version vectors and version sequence tracking to events table for concurrent conflict resolution

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS version_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Comment describing the version vector strategy
COMMENT ON COLUMN public.events.version_vector IS 'JSONB version vector mapping client/admin IDs to sequence numbers for CRDT/3-way differential sync conflict resolution';

-- Helper function to increment event version vector
CREATE OR REPLACE FUNCTION public.increment_event_version_vector(
  p_event_id UUID,
  p_client_id TEXT,
  p_new_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_vector JSONB;
  v_updated_vector JSONB;
  v_current_seq INT;
BEGIN
  SELECT version_vector INTO v_current_vector
  FROM public.events
  WHERE id = p_event_id;

  IF v_current_vector IS NULL THEN
    v_current_vector := '{}'::jsonb;
  END IF;

  v_current_seq := COALESCE((v_current_vector ->> p_client_id)::INT, 0) + 1;
  v_updated_vector := jsonb_set(v_current_vector, ARRAY[p_client_id], to_jsonb(v_current_seq));

  UPDATE public.events
  SET 
    version_vector = v_updated_vector,
    version = COALESCE(p_new_version, version + 1),
    updated_at = NOW()
  WHERE id = p_event_id;

  RETURN v_updated_vector;
END;
$$;
