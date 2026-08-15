-- Migration: 20261027000000_peer_to_peer_event_invites.sql
-- Description: Implement Peer-to-Peer Event Invites with Referral Tracking and Point Rewards (#3294).

-- 1. Create event_referrals table
CREATE TABLE IF NOT EXISTS public.event_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_referred_user_event UNIQUE (referred_user_id, event_id),
    CONSTRAINT self_referral_check CHECK (referrer_user_id <> referred_user_id)
);

-- Enable RLS
ALTER TABLE public.event_referrals ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS "service_role has full access to event_referrals" ON public.event_referrals;
CREATE POLICY "service_role has full access to event_referrals"
    ON public.event_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view their own referrals
DROP POLICY IF EXISTS "Users can view own referrals" ON public.event_referrals;
CREATE POLICY "Users can view own referrals" ON public.event_referrals
    FOR SELECT TO authenticated
    USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- Club organizers can view referrals for their events
DROP POLICY IF EXISTS "Club organizers can view referrals for their events" ON public.event_referrals;
CREATE POLICY "Club organizers can view referrals for their events" ON public.event_referrals
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.club_members cm ON e.club_id = cm.club_id
            WHERE e.id = event_referrals.event_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('admin', 'officer')
              AND cm.status = 'approved'
        )
    );

-- 2. Add referred_by column to event_rsvps table
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Drop all possible overloaded versions of join_event_or_waitlist to ensure clean override
DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID);
DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT, UUID);

-- 4. Create unified join_event_or_waitlist RPC supporting resume_path and referred_by
CREATE OR REPLACE FUNCTION public.join_event_or_waitlist(
    p_event_id UUID,
    p_user_id UUID,
    p_is_anonymous BOOLEAN DEFAULT FALSE,
    p_resume_path TEXT DEFAULT NULL,
    p_referred_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_is_resume_required BOOLEAN;
    v_current_attending INTEGER;
    v_existing_status TEXT;
    v_waitlist_position INTEGER;
BEGIN
    -- ── Lock the event row to serialise concurrent joins ────────
    SELECT max_attendees, is_resume_required
    INTO v_max_attendees, v_is_resume_required
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    -- Resume check
    IF v_is_resume_required AND p_resume_path IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A resume is required to RSVP for this event.'
        );
    END IF;

    -- ── Check for an existing RSVP by this user ─────────────────
    SELECT status
    INTO v_existing_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_existing_status = 'attending' THEN
        UPDATE public.event_rsvps 
        SET is_anonymous = p_is_anonymous,
            resume_path = COALESCE(p_resume_path, resume_path),
            referred_by = COALESCE(p_referred_by, referred_by)
        WHERE event_id = p_event_id AND user_id = p_user_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending',
            'message', 'Already RSVPed as attending. Details updated.'
        );
    END IF;

    IF v_existing_status = 'waitlisted' THEN
        UPDATE public.event_rsvps 
        SET is_anonymous = p_is_anonymous,
            resume_path = COALESCE(p_resume_path, resume_path),
            referred_by = COALESCE(p_referred_by, referred_by)
        WHERE event_id = p_event_id AND user_id = p_user_id;

        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- ── If user had previously cancelled, reactivate ────────────
    IF v_existing_status = 'cancelled' THEN
        PERFORM 1
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status = 'cancelled'
        FOR UPDATE;

        SELECT COUNT(*)
        INTO v_current_attending
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'attending';

        IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
            UPDATE public.event_rsvps
            SET status = 'attending', 
                rsvp_at = NOW(), 
                checked_in = FALSE, 
                is_anonymous = p_is_anonymous,
                resume_path = COALESCE(p_resume_path, resume_path),
                referred_by = COALESCE(p_referred_by, referred_by)
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            RETURN jsonb_build_object(
                'success', true,
                'status', 'attending'
            );
        ELSE
            UPDATE public.event_rsvps
            SET status = 'waitlisted', 
                rsvp_at = NOW(), 
                is_anonymous = p_is_anonymous,
                resume_path = COALESCE(p_resume_path, resume_path),
                referred_by = COALESCE(p_referred_by, referred_by)
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            SELECT COUNT(*)
            INTO v_waitlist_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at <= (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waitlisted',
                'position', v_waitlist_position
            );
        END IF;
    END IF;

    -- ── New RSVP: insert as attending or waitlisted ────────────
    SELECT COUNT(*)
    INTO v_current_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'attending';

    IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, is_anonymous, resume_path, referred_by)
        VALUES (p_event_id, p_user_id, 'attending', NOW(), p_is_anonymous, p_resume_path, p_referred_by)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'attending', 
                rsvp_at = NOW(), 
                checked_in = FALSE, 
                is_anonymous = p_is_anonymous,
                resume_path = COALESCE(p_resume_path, event_rsvps.resume_path),
                referred_by = COALESCE(p_referred_by, event_rsvps.referred_by);
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending'
        );
    ELSE
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, is_anonymous, resume_path, referred_by)
        VALUES (p_event_id, p_user_id, 'waitlisted', NOW(), p_is_anonymous, p_resume_path, p_referred_by)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'waitlisted', 
                rsvp_at = NOW(), 
                is_anonymous = p_is_anonymous,
                resume_path = COALESCE(p_resume_path, event_rsvps.resume_path),
                referred_by = COALESCE(p_referred_by, event_rsvps.referred_by);
        SELECT COUNT(*)
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at <= (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT, UUID) TO authenticated;

-- 5. Trigger on event_rsvps to log referrals and credit Gamification Points (50 pts each)
CREATE OR REPLACE FUNCTION public.handle_event_referral_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_title TEXT;
    v_referrer_name TEXT;
    v_referred_name TEXT;
BEGIN
    -- Only reward if status becomes 'attending' and a valid referrer exists (and not self-referral)
    IF NEW.status = 'attending' AND NEW.referred_by IS NOT NULL AND NEW.referred_by <> NEW.user_id THEN
        -- Prevent duplicate point rewards for same referred user and event
        IF NOT EXISTS (
            SELECT 1 FROM public.event_referrals
            WHERE referred_user_id = NEW.user_id AND event_id = NEW.event_id
        ) THEN
            -- Fetch event and user details for point descriptions
            SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;
            SELECT first_name || ' ' || last_name INTO v_referrer_name FROM public.profiles WHERE id = NEW.referred_by;
            SELECT first_name || ' ' || last_name INTO v_referred_name FROM public.profiles WHERE id = NEW.user_id;

            -- Log referral
            INSERT INTO public.event_referrals (referrer_user_id, referred_user_id, event_id)
            VALUES (NEW.referred_by, NEW.user_id, NEW.event_id);

            -- Credit Referrer points
            INSERT INTO public.points_ledger (user_id, amount, reason)
            VALUES (
                NEW.referred_by,
                50,
                'Referral Bonus: Invited ' || COALESCE(v_referred_name, 'a friend') || ' to event "' || COALESCE(v_event_title, 'Event') || '"'
            );

            -- Credit Invitee points
            INSERT INTO public.points_ledger (user_id, amount, reason)
            VALUES (
                NEW.user_id,
                50,
                'Referral Bonus: Joined event "' || COALESCE(v_event_title, 'Event') || '" via invite from ' || COALESCE(v_referrer_name, 'a friend')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_event_referral_award ON public.event_rsvps;
CREATE TRIGGER trigger_event_referral_award
    AFTER INSERT OR UPDATE ON public.event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_event_referral_rewards();

-- 6. Leaderboard RPC get_event_top_promoters
CREATE OR REPLACE FUNCTION public.get_event_top_promoters(p_event_id UUID)
RETURNS TABLE (
    referrer_id UUID,
    referrer_name TEXT,
    referrer_handle TEXT,
    referrer_avatar_url TEXT,
    referral_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        er.referrer_user_id AS referrer_id,
        (p.first_name || ' ' || p.last_name)::text AS referrer_name,
        p.handle::text AS referrer_handle,
        p.avatar_url::text AS referrer_avatar_url,
        COUNT(*)::bigint AS referral_count
    FROM public.event_referrals er
    JOIN public.profiles p ON er.referrer_user_id = p.id
    WHERE er.event_id = p_event_id
    GROUP BY er.referrer_user_id, p.first_name, p.last_name, p.handle, p.avatar_url
    ORDER BY referral_count DESC
    LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_top_promoters(UUID) TO authenticated;
