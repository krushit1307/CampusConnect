-- Migration: Add human-readable short_id to events table
-- Format: EVT-YYYY-NNNN (e.g., EVT-2026-0042)

-- UP migration

-- 1. Add short_id column (nullable initially for existing rows)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- 2. Create sequence for generating sequential numbers
CREATE SEQUENCE IF NOT EXISTS event_short_seq
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

-- 3. Create trigger function to generate short_id
CREATE OR REPLACE FUNCTION generate_event_short_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate short_id if it's NULL
  IF NEW.short_id IS NULL THEN
    NEW.short_id := 'EVT-' || 
                    EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
                    LPAD(nextval('event_short_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trg_generate_event_short_id ON events;
CREATE TRIGGER trg_generate_event_short_id
BEFORE INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION generate_event_short_id();

-- 5. Backfill existing events with short_ids
-- Set sequence to start after the highest existing event count
DO $$
DECLARE
  max_count INTEGER;
BEGIN
  -- Get current count of existing events
  SELECT COUNT(*) INTO max_count FROM events;
  
  -- Set sequence to start after existing count
  IF max_count > 0 THEN
    PERFORM setval('event_short_seq', max_count, true);
  END IF;
  
  -- Generate short_ids for existing events that don't have one
  UPDATE events
  SET short_id = 'EVT-' || 
                EXTRACT(YEAR FROM created_at)::TEXT || '-' || 
                LPAD(nextval('event_short_seq')::TEXT, 4, '0')
  WHERE short_id IS NULL;
END $$;

-- DOWN migration

-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS trg_generate_event_short_id ON events;
-- DROP FUNCTION IF EXISTS generate_event_short_id();
-- DROP SEQUENCE IF EXISTS event_short_seq;
-- ALTER TABLE events DROP COLUMN IF EXISTS short_id;
