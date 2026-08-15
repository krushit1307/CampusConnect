-- Migration: 20260814190000_live_event_support_chat.sql
-- Description: Create event_support_sessions, event_support_messages, event_support_blocked_users,
--               and block_support_user RPC function (#3016).

-- 1. Create event_support_sessions table
CREATE TABLE IF NOT EXISTS public.event_support_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    support_lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, blocked, closed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, attendee_id)
);

-- 2. Create event_support_messages table
CREATE TABLE IF NOT EXISTS public.event_support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.event_support_sessions(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create event_support_blocked_users table for 1-click anti-abuse bans
CREATE TABLE IF NOT EXISTS public.event_support_blocked_users (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_support_blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendees and support leads can view support sessions"
    ON public.event_support_sessions FOR SELECT
    USING (attendee_id = auth.uid() OR support_lead_id = auth.uid() OR auth.role() = 'authenticated');

CREATE POLICY "Session participants can view support messages"
    ON public.event_support_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.event_support_sessions s
            WHERE s.id = session_id AND (s.attendee_id = auth.uid() OR s.support_lead_id = auth.uid())
        )
    );

-- 4. RPC function to 1-click block abusive users from event support chat
CREATE OR REPLACE FUNCTION public.block_support_user(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
    -- Add user to blocked list
    INSERT INTO public.event_support_blocked_users (event_id, user_id)
    VALUES (p_event_id, p_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- Update support session status to blocked
    UPDATE public.event_support_sessions
    SET status = 'blocked', updated_at = NOW()
    WHERE event_id = p_event_id AND attendee_id = p_user_id;

    RETURN QUERY SELECT TRUE, 'User blocked from event support chat successfully.';
END;
$$;
