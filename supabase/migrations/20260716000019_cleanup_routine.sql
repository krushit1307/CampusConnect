CREATE OR REPLACE FUNCTION public.cleanup_records()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
-- deletes expired events
    DELETE FROM events
    WHERE end_date IS NOT NULL
      AND end_date < NOW();

-- deletes pending requests
    DELETE FROM club_members
    WHERE status = 'pending'
      AND joined_at < NOW() - INTERVAL '3 months';

-- deletes posts   
    DELETE FROM posts
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;