-- Migration: 20261022000000_watch_checkin_dashboard.sql
-- Description: Create watch_pairings table and helper RPCs for watch authentication and event capacity management.

-- 1. Create pairings table
CREATE TABLE IF NOT EXISTS public.watch_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pairing_code VARCHAR(4) NOT NULL,
    session_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for expiration lookups
CREATE INDEX IF NOT EXISTS idx_watch_pairings_code ON public.watch_pairings(pairing_code, is_used, expires_at);

-- Enable RLS
ALTER TABLE public.watch_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Watch pairings are system managed" ON public.watch_pairings
    FOR ALL USING (FALSE);

-- 2. Create create_watch_pairing RPC
CREATE OR REPLACE FUNCTION public.create_watch_pairing(p_session_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Check if authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- Generate random 4-digit numeric code
    v_code := FLOOR(RANDOM() * 9000 + 1000)::INTEGER::TEXT;

    -- Clean up previous unused codes for this user
    DELETE FROM public.watch_pairings WHERE user_id = auth.uid();

    -- Insert new pairing record
    INSERT INTO public.watch_pairings (user_id, pairing_code, session_token, expires_at)
    VALUES (auth.uid(), v_code, p_session_token, NOW() + INTERVAL '5 minutes');

    RETURN v_code;
END;
$$;

-- 3. Create verify_watch_pairing RPC
CREATE OR REPLACE FUNCTION public.verify_watch_pairing(p_pairing_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
    v_id UUID;
BEGIN
    -- Find and lock pairing code
    SELECT id, session_token INTO v_id, v_token
    FROM public.watch_pairings
    WHERE pairing_code = p_pairing_code
      AND is_used = FALSE
      AND expires_at > NOW()
    LIMIT 1
    FOR UPDATE;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired pairing code';
    END IF;

    -- Mark as used
    UPDATE public.watch_pairings
    SET is_used = TRUE
    WHERE id = v_id;

    RETURN v_token;
END;
$$;

-- 4. Create increment_event_capacity RPC
CREATE OR REPLACE FUNCTION public.increment_event_capacity(
    p_event_id UUID,
    p_increment_amount INTEGER DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- Update max_attendees
    UPDATE public.events
    SET max_attendees = COALESCE(max_attendees, 0) + p_increment_amount
    WHERE id = p_event_id;
END;
$$;
