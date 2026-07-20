-- 1. Add composite index on saved_events(event_id, user_id)
CREATE INDEX IF NOT EXISTS idx_saved_events_event_user 
ON public.saved_events(event_id, user_id);

-- 2. Add composite index on club_members(club_id, status)
CREATE INDEX IF NOT EXISTS idx_club_members_club_status 
ON public.club_members(club_id, status);
