-- Add status column if it doesn't exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create an index to keep queries fast
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- Update the club_analytics_view to include status
DROP VIEW IF EXISTS club_analytics_view;
CREATE OR REPLACE VIEW club_analytics_view AS
SELECT 
    e.id,
    e.club_id,
    e.title,
    e.description,
    e.banner_url,
    e.event_date,
    e.start_date,
    e.end_date,
    e.location,
    e.created_by,
    e.created_at,
    e.updated_at,
    e.status,
    COALESCE(COUNT(r.id), 0)::integer AS attendee_count
FROM events e
LEFT JOIN event_rsvps r ON e.id = r.event_id
GROUP BY e.id;
GRANT SELECT ON club_analytics_view TO authenticated, anon;

-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the function
CREATE OR REPLACE FUNCTION public.archive_old_events()
RETURNS void AS $$
BEGIN
    UPDATE public.events
    SET status = 'archived'
    WHERE end_date < NOW() - INTERVAL '30 days'
      AND status != 'archived';
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job
-- Use DO block to safely schedule without erroring if already exists
DO $$
BEGIN
    PERFORM cron.schedule('archive-old-events', '0 0 * * *', 'SELECT public.archive_old_events()');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
