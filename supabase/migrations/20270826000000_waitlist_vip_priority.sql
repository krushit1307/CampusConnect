-- Migration: 20270826000000_waitlist_vip_priority.sql
-- Description: Implement Automated "Waitlist Promotion" VIP Priority, prioritizing Premium members.

-- 1. Safely add 'Premium' to user_role enum if it does not exist
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Premium';

-- 2. Update promote_waitlist_attendee trigger function to prioritize Premium members
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
    v_priority_rules JSONB;
    v_current_year INTEGER;
BEGIN
    -- Get priority rules for this event
    SELECT priority_rules INTO v_priority_rules FROM public.events WHERE id = OLD.event_id;
    v_current_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- Find and lock the highest priority waitlist record for the event
    -- Algorithm: Prioritize Premium users, then apply priority rules and chronological order
    SELECT 
        w.id, 
        w.event_id, 
        w.user_id 
    INTO next_waitlist_record
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = OLD.event_id
    ORDER BY
        CASE WHEN p.role = 'Premium' THEN 1 ELSE 2 END ASC,
        (
            100.0
            - (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600.0)
            + CASE 
                WHEN (v_priority_rules->>'prioritize_seniors')::boolean = true 
                     AND p.graduation_year = v_current_year 
                THEN 500.0 
                ELSE 0.0 
              END
        ) DESC,
        -- Strictly chronological tie-breaker (oldest registration first)
        w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If a waitlisted student exists, promote them to active RSVP and remove from waitlist
    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

-- 3. Update get_waitlist_position RPC function to prioritize Premium members
CREATE OR REPLACE FUNCTION public.get_waitlist_position(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'position', (
      SELECT COALESCE(MIN(ranked.rnk), 0)
      FROM (
        SELECT 
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE WHEN p.role = 'Premium' THEN 1 ELSE 2 END ASC, 
              w.created_at ASC
          ) AS rnk,
          w.user_id
        FROM public.event_waitlist w
        JOIN public.profiles p ON p.id = w.user_id
        WHERE w.event_id = p_event_id
      ) ranked
      WHERE ranked.user_id = auth.uid()
    ),
    'total_waitlisted', (
      SELECT COUNT(*)::INT
      FROM public.event_waitlist
      WHERE event_id = p_event_id
    ),
    'has_active_offer', (
      SELECT EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = auth.uid()
          AND status = 'approved'
          AND claim_expires_at > NOW()
      )
    )
  );
$$;

-- 4. Update promote_top_dynamic_waitlist_user RPC function to prioritize Premium members
CREATE OR REPLACE FUNCTION public.promote_top_dynamic_waitlist_user(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    top_record RECORD;
    v_user_name TEXT;
BEGIN
    -- Recalculate priority scores for event waitlist
    UPDATE public.event_waitlist w
    SET priority_score = public.calculate_user_waitlist_priority_score(w.user_id, w.created_at)
    WHERE w.event_id = p_event_id;

    -- Fetch top priority waitlisted user
    SELECT w.id, w.event_id, w.user_id, w.priority_score, p.full_name
    INTO top_record
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = p_event_id
    ORDER BY 
        CASE WHEN p.role = 'Premium' THEN 1 ELSE 2 END ASC,
        w.priority_score DESC, 
        w.created_at ASC
    LIMIT 1;

    IF top_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Waitlist is empty');
    END IF;

    -- Promote to event_rsvps
    INSERT INTO public.event_rsvps (event_id, user_id, status)
    VALUES (top_record.event_id, top_record.user_id, 'attending')
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- Remove from waitlist
    DELETE FROM public.event_waitlist WHERE id = top_record.id;

    RETURN jsonb_build_object(
        'success', true,
        'promoted_user_id', top_record.user_id,
        'user_full_name', top_record.full_name,
        'priority_score', top_record.priority_score
    );
END;
$$;

-- 5. Conditionally update promote_next_waitlisted_user if rsvps table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rsvps') THEN
        EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.promote_next_waitlisted_user(p_event_id UUID)
        RETURNS UUID
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_rsvp_id UUID;
        BEGIN
            SELECT r.id INTO v_rsvp_id
            FROM public.rsvps r
            JOIN public.profiles p ON p.id = r.user_id
            WHERE r.event_id = p_event_id
              AND r.status = 'waitlisted'
            ORDER BY 
                CASE WHEN p.role = 'Premium' THEN 1 ELSE 2 END ASC, 
                r.created_at ASC
            LIMIT 1;

            IF v_rsvp_id IS NOT NULL THEN
                UPDATE public.rsvps
                SET status = 'pending_payment',
                    payment_deadline = NOW() + INTERVAL '15 minutes',
                    updated_at = NOW()
                WHERE id = v_rsvp_id;
            END IF;

            RETURN v_rsvp_id;
        END;
        $body$;
        $fn$;
    END IF;
END $$;
