-- Add deleted_at columns
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create rules to intercept DELETE statements and convert them to UPDATE
CREATE RULE soft_delete_events AS ON DELETE TO public.events
DO INSTEAD UPDATE public.events SET deleted_at = NOW() WHERE id = OLD.id AND deleted_at IS NULL;

CREATE RULE soft_delete_clubs AS ON DELETE TO public.clubs
DO INSTEAD UPDATE public.clubs SET deleted_at = NOW() WHERE id = OLD.id AND deleted_at IS NULL;

CREATE RULE soft_delete_event_rsvps AS ON DELETE TO public.event_rsvps
DO INSTEAD UPDATE public.event_rsvps SET deleted_at = NOW() WHERE id = OLD.id AND deleted_at IS NULL;

-- Update RLS policies to filter out soft-deleted rows

-- Events
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
CREATE POLICY "Events are viewable by everyone." ON public.events FOR SELECT USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = events.club_id
      AND (
        clubs.visibility = 'public'
        OR public.is_club_member(clubs.id, auth.uid())
        OR auth.uid() = clubs.created_by
      )
  )
);

-- Clubs
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
CREATE POLICY "Clubs are viewable by everyone." ON public.clubs FOR SELECT USING (
  deleted_at IS NULL AND
  (
    visibility = 'public'
    OR public.is_club_member(id, auth.uid())
    OR auth.uid() = created_by
  )
);

-- RSVPs
DROP POLICY IF EXISTS "Users can read own RSVPs." ON public.event_rsvps;
CREATE POLICY "Users can read own RSVPs." ON public.event_rsvps FOR SELECT USING (
  deleted_at IS NULL AND auth.uid() = user_id
);

DROP POLICY IF EXISTS "Club admins can read all RSVPs." ON public.event_rsvps;
CREATE POLICY "Club admins can read all RSVPs." ON public.event_rsvps FOR SELECT USING (
  deleted_at IS NULL AND
  (
    public.is_club_admin((SELECT club_id FROM events WHERE id = event_rsvps.event_id), auth.uid()) OR
    EXISTS (SELECT 1 FROM clubs WHERE id = (SELECT club_id FROM events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
  )
);
