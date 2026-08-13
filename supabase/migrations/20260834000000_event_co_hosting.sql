-- Migration: event_co_hosting
-- Description: Implement unified event co-hosting model via event_hosts table.

-- 1. Create event_hosts junction table
CREATE TABLE IF NOT EXISTS public.event_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    is_primary_host BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, club_id)
);

-- 2. Backfill data
-- Backfill primary hosts from events table
INSERT INTO public.event_hosts (event_id, club_id, is_primary_host, status)
SELECT id, club_id, TRUE, 'accepted'
FROM public.events
WHERE club_id IS NOT NULL
ON CONFLICT (event_id, club_id) DO NOTHING;

-- Backfill co-hosts from event_co_hosts table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_co_hosts') THEN
        INSERT INTO public.event_hosts (event_id, club_id, is_primary_host, status)
        SELECT event_id, club_id, FALSE, 'accepted'
        FROM public.event_co_hosts
        ON CONFLICT (event_id, club_id) DO UPDATE SET is_primary_host = EXCLUDED.is_primary_host;
        
        DROP TABLE public.event_co_hosts CASCADE;
    END IF;
END $$;

-- 3. Drop legacy column club_id from events
ALTER TABLE public.events DROP COLUMN IF EXISTS club_id CASCADE;

-- 4. Helper function to check if a user is an admin for any host of an event
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.event_hosts h
        JOIN public.club_members m ON h.club_id = m.club_id
        WHERE h.event_id = p_event_id
          AND m.user_id = p_user_id
          AND m.role = 'admin'
          AND m.status = 'approved'
    ) OR EXISTS (
        SELECT 1 
        FROM public.event_hosts h
        JOIN public.clubs c ON h.club_id = c.id
        WHERE h.event_id = p_event_id
          AND c.created_by = p_user_id
    ) OR EXISTS (
        -- Also check event creator
        SELECT 1 
        FROM public.events
        WHERE id = p_event_id
          AND created_by = p_user_id
    );
END;
$$;

-- 5. Helper function to check if user is admin of a specific club
CREATE OR REPLACE FUNCTION public.is_club_admin_check(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.club_members 
        WHERE club_id = p_club_id 
          AND user_id = p_user_id 
          AND role = 'admin' 
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 
        FROM public.clubs 
        WHERE id = p_club_id 
          AND created_by = p_user_id
    );
END;
$$;

-- 6. Trigger to notify admins when invited to co-host
CREATE OR REPLACE FUNCTION public.on_event_cohost_invited()
RETURNS TRIGGER AS $$
DECLARE
    v_event_title TEXT;
    v_club_name TEXT;
    v_admin_id UUID;
BEGIN
    IF NEW.is_primary_host = FALSE AND NEW.status = 'pending' THEN
        SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;
        SELECT name INTO v_club_name FROM public.clubs WHERE id = NEW.club_id;
        
        FOR v_admin_id IN 
            SELECT user_id 
            FROM public.club_members 
            WHERE club_id = NEW.club_id 
              AND role = 'admin' 
              AND status = 'approved'
        LOOP
            INSERT INTO public.notifications (user_id, type, title, message, link)
            VALUES (
                v_admin_id,
                'cohost_invitation',
                'Co-Hosting Invitation',
                'Your club, ' || v_club_name || ', has been invited to co-host the event "' || v_event_title || '".',
                '/clubs/' || NEW.club_id || '/manage'
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_event_cohost_invited
AFTER INSERT ON public.event_hosts
FOR EACH ROW
EXECUTE FUNCTION public.on_event_cohost_invited();

-- 7. Recreate RLS policies on event_hosts
ALTER TABLE public.event_hosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event hosts are viewable by everyone." ON public.event_hosts;
CREATE POLICY "Event hosts are viewable by everyone." ON public.event_hosts
FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins of primary host can add co-hosts." ON public.event_hosts;
CREATE POLICY "Admins of primary host can add co-hosts." ON public.event_hosts
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.event_hosts ph
        WHERE ph.event_id = event_hosts.event_id
          AND ph.is_primary_host = TRUE
          AND public.is_club_admin_check(ph.club_id, auth.uid())
    ) OR EXISTS (
        SELECT 1 
        FROM public.events e
        WHERE e.id = event_hosts.event_id
          AND e.created_by = auth.uid()
    ) OR (
        -- Allow initial insert of primary host during event creation
        event_hosts.is_primary_host = TRUE
    )
);

DROP POLICY IF EXISTS "Admins of co-hosting club can update status." ON public.event_hosts;
CREATE POLICY "Admins of co-hosting club can update status." ON public.event_hosts
FOR UPDATE USING (
    public.is_club_admin_check(club_id, auth.uid())
) WITH CHECK (
    public.is_club_admin_check(club_id, auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete host records." ON public.event_hosts;
CREATE POLICY "Admins can delete host records." ON public.event_hosts
FOR DELETE USING (
    public.is_club_admin_check(club_id, auth.uid())
    OR EXISTS (
        SELECT 1 
        FROM public.event_hosts ph
        WHERE ph.event_id = event_hosts.event_id
          AND ph.is_primary_host = TRUE
          AND public.is_club_admin_check(ph.club_id, auth.uid())
    )
);

-- 8. Recreate RLS policies on events table
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON public.events;
CREATE POLICY "Events are viewable by public or club members." ON public.events
  FOR SELECT USING (
    (
      deleted_at IS NULL OR 
      public.is_system_admin() OR 
      (deleted_at IS NOT NULL AND public.is_event_admin(id, auth.uid()))
    ) AND (
      is_private IS FALSE OR is_private IS NULL OR
      auth.uid() = created_by OR
      public.is_event_admin(id, auth.uid()) OR
      EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Club admins can insert events." ON public.events;
CREATE POLICY "Club admins can insert events." ON public.events
  FOR INSERT WITH CHECK (
    TRUE -- Inserting events is allowed, checked via event_hosts insertion rules
  );

DROP POLICY IF EXISTS "Club admins can update events." ON public.events;
CREATE POLICY "Club admins can update events." ON public.events
  FOR UPDATE USING (
    public.is_event_admin(id, auth.uid())
    OR EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Club admins can delete events." ON public.events;
CREATE POLICY "Club admins can delete events." ON public.events
  FOR DELETE USING (
    public.is_event_admin(id, auth.uid())
    OR EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
  );

-- 9. Recreate RLS policies on event_rsvps table
DROP POLICY IF EXISTS "Club admins can read all RSVPs." ON public.event_rsvps;
CREATE POLICY "Club admins can read all RSVPs." ON public.event_rsvps
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_event_admin(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "Club admins can update RSVPs (check in)." ON public.event_rsvps;
CREATE POLICY "Club admins can update RSVPs (check in)." ON public.event_rsvps
  FOR UPDATE USING (
    public.is_event_admin(event_id, auth.uid())
  );
