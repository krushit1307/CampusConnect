-- Migration: 20270105000000_skill_swap_marketplace.sql
-- Description: Implement Dynamic Skill Swap Marketplace (#3605) with matching algorithm.

-- 1. Create skill_swaps table
CREATE TABLE IF NOT EXISTS public.skill_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    offering_skill TEXT NOT NULL,
    requesting_skill TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, offering_skill, requesting_skill)
);

CREATE INDEX IF NOT EXISTS idx_skill_swaps_user ON public.skill_swaps(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_swaps_offering ON public.skill_swaps(offering_skill);
CREATE INDEX IF NOT EXISTS idx_skill_swaps_requesting ON public.skill_swaps(requesting_skill);

-- 2. Create skill_swap_matches table
CREATE TABLE IF NOT EXISTS public.skill_swap_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_a_to_b TEXT NOT NULL, -- What user A teaches B
    skill_b_to_a TEXT NOT NULL, -- What user B teaches A
    user_a_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    user_b_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_a_id, user_b_id, skill_a_to_b, skill_b_to_a)
);

CREATE INDEX IF NOT EXISTS idx_skill_swap_matches_users ON public.skill_swap_matches(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_skill_swap_matches_status ON public.skill_swap_matches(status);

-- 3. Enable RLS
ALTER TABLE public.skill_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_swap_matches ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view all skill swaps" ON public.skill_swaps;
CREATE POLICY "Users can view all skill swaps" ON public.skill_swaps
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage their own skill swaps" ON public.skill_swaps;
CREATE POLICY "Users can manage their own skill swaps" ON public.skill_swaps
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their matches" ON public.skill_swap_matches;
CREATE POLICY "Users can view their matches" ON public.skill_swap_matches
    FOR SELECT TO authenticated
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Users can update their matches" ON public.skill_swap_matches;
CREATE POLICY "Users can update their matches" ON public.skill_swap_matches
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- 5. Bipartite Match Algorithm Trigger
CREATE OR REPLACE FUNCTION public.tr_check_skill_swap_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_user_a_name TEXT;
    v_user_b_name TEXT;
BEGIN
    -- Query all users B offering what user A (NEW) wants, and wanting what user A (NEW) offers
    FOR r IN
        SELECT *
        FROM public.skill_swaps
        WHERE offering_skill ILIKE NEW.requesting_skill
          AND requesting_skill ILIKE NEW.offering_skill
          AND user_id != NEW.user_id
    LOOP
        -- Check if match already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.skill_swap_matches
            WHERE (user_a_id = NEW.user_id AND user_b_id = r.user_id AND skill_a_to_b = NEW.offering_skill AND skill_b_to_a = r.offering_skill)
               OR (user_a_id = r.user_id AND user_b_id = NEW.user_id AND skill_a_to_b = r.offering_skill AND skill_b_to_a = NEW.offering_skill)
        ) THEN
            -- Insert the match record
            INSERT INTO public.skill_swap_matches (
                user_a_id, user_b_id, skill_a_to_b, skill_b_to_a, status
            ) VALUES (
                NEW.user_id, r.user_id, NEW.offering_skill, r.offering_skill, 'matched'
            );

            -- Fetch profiles for friendly names
            SELECT COALESCE(first_name, 'Another Student') INTO v_user_a_name FROM public.profiles WHERE id = NEW.user_id;
            SELECT COALESCE(first_name, 'Another Student') INTO v_user_b_name FROM public.profiles WHERE id = r.user_id;

            -- Notify User A about match with User B
            PERFORM public.queue_or_send_notification(
                p_user_id => NEW.user_id,
                p_notification_type => 'skill_swap_match',
                p_title => 'Perfect Match Found!',
                p_message => 'Would you like to connect with ' || v_user_b_name || ' to swap ' || NEW.offering_skill || ' for ' || r.offering_skill || '?',
                p_link => '/skill-swap',
                p_actor_id => r.user_id
            );

            -- Notify User B about match with User A
            PERFORM public.queue_or_send_notification(
                p_user_id => r.user_id,
                p_notification_type => 'skill_swap_match',
                p_title => 'Perfect Match Found!',
                p_message => 'Would you like to connect with ' || v_user_a_name || ' to swap ' || r.offering_skill || ' for ' || NEW.offering_skill || '?',
                p_link => '/skill-swap',
                p_actor_id => NEW.user_id
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tr_skill_swap_match_check
AFTER INSERT ON public.skill_swaps
FOR EACH ROW
EXECUTE FUNCTION public.tr_check_skill_swap_match();

-- 6. RPC functions for accepts and rejects
CREATE OR REPLACE FUNCTION public.accept_skill_swap_match(
    p_match_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_partner_id UUID;
    v_my_name TEXT;
BEGIN
    SELECT * INTO v_match FROM public.skill_swap_matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found.';
    END IF;

    IF auth.uid() = v_match.user_a_id THEN
        UPDATE public.skill_swap_matches
        SET user_a_accepted = TRUE,
            updated_at = NOW()
        WHERE id = p_match_id;
        v_partner_id := v_match.user_b_id;
    ELSIF auth.uid() = v_match.user_b_id THEN
        UPDATE public.skill_swap_matches
        SET user_b_accepted = TRUE,
            updated_at = NOW()
        WHERE id = p_match_id;
        v_partner_id := v_match.user_a_id;
    ELSE
        RAISE EXCEPTION 'Not authorized to accept this match.';
    END IF;

    -- Reload match details
    SELECT * INTO v_match FROM public.skill_swap_matches WHERE id = p_match_id;

    -- If both users accepted, complete the match and notify both
    IF v_match.user_a_accepted = TRUE AND v_match.user_b_accepted = TRUE THEN
        UPDATE public.skill_swap_matches
        SET status = 'accepted',
            updated_at = NOW()
        WHERE id = p_match_id;

        -- Get my name
        SELECT COALESCE(first_name, 'A Student') INTO v_my_name FROM public.profiles WHERE id = auth.uid();

        -- Send push to partner
        PERFORM public.queue_or_send_notification(
            p_user_id => v_partner_id,
            p_notification_type => 'skill_swap_accepted',
            p_title => 'Match Connected! 🤝',
            p_message => v_my_name || ' accepted the swap! Go coordinate your meetup.',
            p_link => '/messages',
            p_actor_id => auth.uid()
        );

        -- Send push to myself
        PERFORM public.queue_or_send_notification(
            p_user_id => auth.uid(),
            p_notification_type => 'skill_swap_accepted',
            p_title => 'Match Connected! 🤝',
            p_message => 'You are now connected! Go coordinate your meetup.',
            p_link => '/messages',
            p_actor_id => v_partner_id
        );
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_skill_swap_match(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_skill_swap_match(
    p_match_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify participant
    IF NOT EXISTS (
        SELECT 1 FROM public.skill_swap_matches
        WHERE id = p_match_id AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Not authorized to reject this match.';
    END IF;

    UPDATE public.skill_swap_matches
    SET status = 'rejected',
        updated_at = NOW()
    WHERE id = p_match_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_skill_swap_match(UUID) TO authenticated;
