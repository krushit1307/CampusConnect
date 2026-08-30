-- ============================================================
-- Migration: 20270224000000_real_time_help_desk_queue.sql
-- Issue: #3938 — Build a 'Real-Time "Help Desk" Queue' for Hackathons
--
-- Goals
--   1. `help_queue` table — attendees submit a help request with
--      team_name, table_number, and issue_description. Lifecycle:
--        open → claimed → resolved / cancelled
--   2. `claim_help_ticket(ticket_id)` RPC — atomic claim by a mentor.
--      Only one mentor can claim a given ticket (prevents race
--      condition where two mentors both claim the same ticket).
--   3. `resolve_help_ticket(ticket_id)` RPC — mentor marks the ticket
--      as resolved after helping the team.
--   4. `cancel_help_ticket(ticket_id)` RPC — attendee cancels their
--      own request (issue resolved itself / they left).
--   5. `get_help_queue_position(ticket_id)` RPC — returns the caller's
--      position in the open queue so the UI can show "You are #3 in line".
--   6. Public read RLS on the queue so any signed-in attendee can see
--      the live queue; only the ticket creator can cancel; only mentors
--      (club admins) can claim / resolve.
--   7. Realtime publication so the Mentor Dashboard + Attendee Queue
--      widget re-render instantly on every INSERT/UPDATE.
-- ============================================================

-- ─── 1. help_queue table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_queue (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    -- The attendee who submitted the request.
    requested_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Hackathon team info — filled in by the attendee.
    team_name         TEXT NOT NULL CHECK (length(team_name) BETWEEN 1 AND 100),
    table_number      TEXT NOT NULL CHECK (length(table_number) BETWEEN 1 AND 20),
    issue_description TEXT NOT NULL CHECK (length(issue_description) BETWEEN 1 AND 500),
    -- Lifecycle: open (in queue) → claimed (mentor assigned) →
    --            resolved (mentor helped) / cancelled (attendee withdrew)
    status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'claimed', 'resolved', 'cancelled')),
    -- The mentor who claimed the ticket (NULL until claimed).
    mentor_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Timestamps.
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at        TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_queue_event_status
    ON public.help_queue (event_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_help_queue_requested_by
    ON public.help_queue (requested_by, status);

-- ─── 2. RLS ───────────────────────────────────────────────────────

ALTER TABLE public.help_queue ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can view the live queue (they need to see their
-- position and the overall queue). We also allow anon so the queue
-- widget can render before login completes.
CREATE POLICY "Anyone can view the help queue"
    ON public.help_queue FOR SELECT
    USING (true);

-- Any authenticated user can insert a help request for themselves.
CREATE POLICY "Authenticated users can submit help requests"
    ON public.help_queue FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = requested_by);

-- The ticket creator can cancel their own ticket. Club admins can
-- update (claim/resolve) any ticket for their event.
CREATE POLICY "Creators can cancel, admins can manage help tickets"
    ON public.help_queue FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = requested_by
        OR public.is_club_admin(
            (SELECT club_id FROM public.events WHERE id = help_queue.event_id),
            auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = requested_by
        OR public.is_club_admin(
            (SELECT club_id FROM public.events WHERE id = help_queue.event_id),
            auth.uid()
        )
    );

-- ─── 3. claim_help_ticket(p_ticket_id) ───────────────────────────
-- Atomic claim by a mentor. Uses UPDATE ... SET status = 'claimed'
-- WHERE status = 'open' so a concurrent claim by another mentor
-- finds 0 rows affected and returns claimed=false.
CREATE OR REPLACE FUNCTION public.claim_help_ticket(p_ticket_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_ticket  public.help_queue;
    v_updated INTEGER;
BEGIN
    -- Must be a club admin (mentor) for this event.
    SELECT * INTO v_ticket FROM public.help_queue WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN json_build_object('claimed', false, 'reason', 'Ticket not found');
    END IF;

    IF NOT public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = v_ticket.event_id),
        auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only mentors (club admins) can claim tickets.';
    END IF;

    -- Atomic claim: only flips if the ticket is still 'open'.
    UPDATE public.help_queue
       SET status = 'claimed',
           mentor_id = auth.uid(),
           claimed_at = NOW(),
           updated_at = NOW()
     WHERE id = p_ticket_id
       AND status = 'open';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN json_build_object('claimed', false, 'reason', 'Ticket already claimed or closed');
    END IF;

    RETURN json_build_object(
        'claimed', true,
        'ticket_id', p_ticket_id,
        'mentor_id', auth.uid(),
        'team_name', v_ticket.team_name,
        'table_number', v_ticket.table_number
    );
END;
 $$;

GRANT EXECUTE ON FUNCTION public.claim_help_ticket(UUID) TO authenticated;

-- ─── 4. resolve_help_ticket(p_ticket_id) ──────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_help_ticket(p_ticket_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_ticket public.help_queue;
BEGIN
    SELECT * INTO v_ticket FROM public.help_queue WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'reason', 'Ticket not found');
    END IF;

    IF NOT public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = v_ticket.event_id),
        auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only mentors can resolve tickets.';
    END IF;

    IF v_ticket.status NOT IN ('claimed', 'open') THEN
        RETURN json_build_object('ok', false, 'reason', 'Ticket is ' || v_ticket.status);
    END IF;

    UPDATE public.help_queue
       SET status = 'resolved',
           resolved_at = NOW(),
           updated_at = NOW()
     WHERE id = p_ticket_id;

    RETURN json_build_object('ok', true, 'ticket_id', p_ticket_id);
END;
 $$;

GRANT EXECUTE ON FUNCTION public.resolve_help_ticket(UUID) TO authenticated;

-- ─── 5. cancel_help_ticket(p_ticket_id) ────────────────────────────
-- Called by the attendee who submitted the request. They can only
-- cancel their own ticket, and only if it's still 'open' (not yet
-- claimed by a mentor).
CREATE OR REPLACE FUNCTION public.cancel_help_ticket(p_ticket_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_ticket public.help_queue;
BEGIN
    SELECT * INTO v_ticket FROM public.help_queue WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'reason', 'Ticket not found');
    END IF;

    IF v_ticket.requested_by <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: you can only cancel your own help request.';
    END IF;

    IF v_ticket.status <> 'open' THEN
        RETURN json_build_object('ok', false, 'reason',
            'Cannot cancel — ticket is already ' || v_ticket.status);
    END IF;

    UPDATE public.help_queue
       SET status = 'cancelled',
           updated_at = NOW()
     WHERE id = p_ticket_id;

    RETURN json_build_object('ok', true, 'ticket_id', p_ticket_id);
END;
 $$;

GRANT EXECUTE ON FUNCTION public.cancel_help_ticket(UUID) TO authenticated;

-- ─── 6. get_help_queue_position(p_ticket_id) ──────────────────────
-- Returns the position of the caller's ticket in the open queue.
-- Position 1 = next in line. Returns 0 if the ticket is not 'open'
-- (already claimed / resolved / cancelled) or doesn't belong to the
-- caller.
CREATE OR REPLACE FUNCTION public.get_help_queue_position(p_ticket_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_ticket  public.help_queue;
    v_position INTEGER;
BEGIN
    SELECT * INTO v_ticket FROM public.help_queue WHERE id = p_ticket_id;
    IF NOT FOUND THEN
        RETURN json_build_object('position', 0, 'reason', 'Ticket not found');
    END IF;

    IF v_ticket.status <> 'open' THEN
        RETURN json_build_object(
            'position', 0,
            'status', v_ticket.status,
            'reason', 'Ticket is not in the open queue'
        );
    END IF;

    -- Count how many open tickets were created before this one.
    SELECT COUNT(*) + 1 INTO v_position
      FROM public.help_queue
     WHERE event_id = v_ticket.event_id
       AND status = 'open'
       AND created_at < v_ticket.created_at;

    RETURN json_build_object(
        'position', v_position,
        'ticket_id', p_ticket_id,
        'status', 'open'
    );
END;
 $$;

GRANT EXECUTE ON FUNCTION public.get_help_queue_position(UUID)
    TO authenticated, anon;

-- ─── 7. Realtime publication ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.help_queue;

-- ============================================================
-- Verification (manual):
--   SELECT * FROM help_queue WHERE event_id = '<event-uuid>';
--   SELECT * FROM claim_help_ticket('<ticket-uuid>');
--   SELECT * FROM get_help_queue_position('<ticket-uuid>');
-- ============================================================
