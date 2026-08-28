-- 1. Create Enum for Club Operational Lifecycles if it doesn't exist
DO $$ BEGIN
    CREATE TYPE club_lifecycle_status AS ENUM ('active', 'warning_issued', 'hibernated', 'decertified');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend the main clubs table with lifecycle columns
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS lifecycle_status club_lifecycle_status DEFAULT 'active' NOT NULL,
ADD COLUMN IF NOT EXISTS lifecycle_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS warning_issued_at TIMESTAMP WITH TIME ZONE;

-- 3. Create high-efficiency indices to track inactive timelines
CREATE INDEX IF NOT EXISTS idx_clubs_lifecycle_status ON public.clubs(lifecycle_status, warning_issued_at);
CREATE INDEX IF NOT EXISTS idx_events_club_timeline ON public.events(club_id, end_time DESC);

-- 4. Create the automated RPC lifecycle auditor
CREATE OR REPLACE FUNCTION public.audit_club_activity_lifecycle()
RETURNS TABLE (
    processed_club_id UUID,
    club_name VARCHAR,
    action_taken VARCHAR,
    president_email VARCHAR
) AS $$
BEGIN
    -- STEP 1: Process Warning Triggers
    -- Find clubs currently 'active' whose most recent event ended over 6 months ago
    RETURN QUERY
    WITH club_last_event AS (
        SELECT c.id AS c_id, c.name AS c_name, MAX(e.end_time) AS last_event_time, c.created_by AS president_id
        FROM public.clubs c
        LEFT JOIN public.events e ON c.id = e.club_id
        WHERE c.lifecycle_status = 'active'
        GROUP BY c.id, c.name, c.created_by
    )
    UPDATE public.clubs
    SET 
        lifecycle_status = 'warning_issued',
        warning_issued_at = NOW(),
        lifecycle_updated_at = NOW()
    FROM club_last_event
    LEFT JOIN public.profiles p ON club_last_event.president_id = p.id
    WHERE clubs.id = club_last_event.c_id 
      AND (club_last_event.last_event_time < NOW() - INTERVAL '6 months' OR club_last_event.last_event_time IS NULL)
      AND clubs.created_at < NOW() - INTERVAL '6 months' -- Protects brand new clubs from instant warnings
    RETURNING clubs.id, clubs.name, 'warning_issued'::VARCHAR, COALESCE(p.email, 'unresolved@platform.edu')::VARCHAR;

    -- STEP 2: Process Hibernation Upgrades
    -- Automatically hibernate clubs that have been on 'warning_issued' for >30 days without creating a new event
    RETURN QUERY
    WITH warning_expired_clubs AS (
        SELECT c.id AS c_id, c.name AS c_name, c.created_by AS president_id
        FROM public.clubs c
        WHERE c.lifecycle_status = 'warning_issued' 
          AND c.warning_issued_at < NOW() - INTERVAL '30 days'
          -- Check to ensure they didn't bypass by publishing an upcoming placeholder event
          AND NOT EXISTS (
              SELECT 1 FROM public.events e 
              WHERE e.club_id = c.id 
                AND e.created_at > c.warning_issued_at
          )
      )
      UPDATE public.clubs
      SET 
          lifecycle_status = 'hibernated',
          lifecycle_updated_at = NOW()
      FROM warning_expired_clubs
      LEFT JOIN public.profiles p ON warning_expired_clubs.president_id = p.id
      WHERE clubs.id = warning_expired_clubs.c_id
      RETURNING clubs.id, clubs.name, 'hibernated'::VARCHAR, COALESCE(p.email, 'unresolved@platform.edu')::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
