-- Migration: Implement soft deletes and trash/restore for events (Issue #1767)

-- 1. Ensure deleted_at column exists
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Modify short_id unique constraint to be a partial index
-- Drop the existing unique constraint (added via ADD COLUMN short_id TEXT UNIQUE)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_short_id_key;
-- Create the partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS events_short_id_active_unique ON public.events(short_id) WHERE deleted_at IS NULL;

-- 3. Update RLS policy to allow club admins to read their deleted events
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON public.events;
CREATE POLICY "Events are viewable by public or club members." ON public.events
  FOR SELECT USING (
    (
      deleted_at IS NULL OR 
      public.is_system_admin() OR 
      (deleted_at IS NOT NULL AND (
        public.is_club_admin(club_id, auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
      ))
    ) AND (
      is_private IS FALSE OR is_private IS NULL OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id = events.club_id
          AND club_members.user_id = auth.uid()
          AND club_members.status = 'approved'
      ) OR
      EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
      EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
    )
  );

-- 4. 30-day automatic cleanup cron job
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.events
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule it if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-soft-deleted-events') THEN
      PERFORM cron.unschedule('cleanup-soft-deleted-events');
    END IF;
    
    PERFORM cron.schedule(
      'cleanup-soft-deleted-events',
      '0 0 * * *', -- Run daily at midnight
      $_$SELECT public.cleanup_soft_deleted_events();$_$
    );
  END IF;
END
$$;
