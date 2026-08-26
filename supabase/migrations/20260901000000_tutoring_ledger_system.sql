-- Migration: 20260901000000_tutoring_ledger_system.sql
-- Description: Peer-to-Peer Tutoring / Time-Banking module

CREATE TABLE public.tutoring_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('offer', 'request')),
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tutoring_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open tutoring listings" ON public.tutoring_listings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own listings" ON public.tutoring_listings
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


CREATE TABLE public.tutoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES public.tutoring_listings(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    provider_confirmed BOOLEAN NOT NULL DEFAULT false,
    receiver_confirmed BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.tutoring_sessions
    FOR SELECT TO authenticated USING (auth.uid() = provider_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create sessions" ON public.tutoring_sessions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = provider_id OR auth.uid() = receiver_id);


CREATE TABLE public.tutoring_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.tutoring_sessions(id) ON DELETE SET NULL,
    subject TEXT,
    hours_credited INT NOT NULL DEFAULT 0,
    hours_debited INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tutoring_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ledger" ON public.tutoring_ledger
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Prevent manual inserts into the ledger, it should only be via RPC
CREATE POLICY "No direct inserts" ON public.tutoring_ledger
    FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct updates" ON public.tutoring_ledger
    FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct deletes" ON public.tutoring_ledger
    FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE VIEW public.tutoring_balances AS
SELECT 
    user_id,
    COALESCE(SUM(hours_credited) - SUM(hours_debited), 0) as balance,
    COALESCE(SUM(hours_credited), 0) as total_earned,
    COALESCE(SUM(hours_debited), 0) as total_spent
FROM public.tutoring_ledger
GROUP BY user_id;

-- RPC to create a request (validates credits)
CREATE OR REPLACE FUNCTION public.create_tutoring_request(p_subject TEXT, p_description TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_balance INT;
    v_listing_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT balance INTO v_balance FROM public.tutoring_balances WHERE user_id = v_user_id;
    IF v_balance IS NULL THEN
        v_balance := 0;
    END IF;

    IF v_balance < 1 THEN
        RAISE EXCEPTION 'Insufficient tutoring credits. You need at least 1 credit to request tutoring.';
    END IF;

    INSERT INTO public.tutoring_listings (user_id, listing_type, subject, description)
    VALUES (v_user_id, 'request', p_subject, p_description)
    RETURNING id INTO v_listing_id;

    RETURN v_listing_id;
END;
$$;


-- RPC to confirm a session
CREATE OR REPLACE FUNCTION public.confirm_tutoring_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_user_id UUID;
    v_receiver_balance INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_session FROM public.tutoring_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    IF v_session.status != 'pending' THEN
        RAISE EXCEPTION 'Session is not pending';
    END IF;

    IF v_user_id = v_session.provider_id THEN
        UPDATE public.tutoring_sessions SET provider_confirmed = true WHERE id = p_session_id;
        v_session.provider_confirmed := true;
    ELSIF v_user_id = v_session.receiver_id THEN
        UPDATE public.tutoring_sessions SET receiver_confirmed = true WHERE id = p_session_id;
        v_session.receiver_confirmed := true;
    ELSE
        RAISE EXCEPTION 'User is not part of this session';
    END IF;

    IF v_session.provider_confirmed AND v_session.receiver_confirmed THEN
        SELECT balance INTO v_receiver_balance FROM public.tutoring_balances WHERE user_id = v_session.receiver_id;
        IF v_receiver_balance IS NULL THEN
            v_receiver_balance := 0;
        END IF;

        IF v_receiver_balance < 1 THEN
            RAISE EXCEPTION 'Receiver does not have enough credits to complete this session';
        END IF;

        UPDATE public.tutoring_sessions SET status = 'completed', completed_at = NOW() WHERE id = p_session_id;

        -- Provider gets 1 credit
        INSERT INTO public.tutoring_ledger (user_id, session_id, subject, hours_credited, hours_debited)
        VALUES (v_session.provider_id, p_session_id, v_session.subject, 1, 0);

        -- Receiver loses 1 credit
        INSERT INTO public.tutoring_ledger (user_id, session_id, subject, hours_credited, hours_debited)
        VALUES (v_session.receiver_id, p_session_id, v_session.subject, 0, 1);
        
        IF v_session.listing_id IS NOT NULL THEN
            UPDATE public.tutoring_listings SET status = 'fulfilled' WHERE id = v_session.listing_id;
        END IF;
    END IF;
END;
$$;
