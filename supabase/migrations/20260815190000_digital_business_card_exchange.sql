-- Migration: 20260815190000_digital_business_card_exchange.sql
-- Description: Create user_connections table and swap_digital_business_cards RPC function (#3020).

-- 1. Create user_connections table
CREATE TABLE IF NOT EXISTS public.user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    met_at_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    shared_permissions JSONB NOT NULL DEFAULT '{"shareEmail": true, "shareLinkedin": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_pair UNIQUE (user_id_1, user_id_2)
);

-- Enable RLS
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
    ON public.user_connections FOR SELECT
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can insert connection records"
    ON public.user_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- 2. Transactional RPC to swap digital business cards between two users
CREATE OR REPLACE FUNCTION public.swap_digital_business_cards(
    p_target_user_id UUID,
    p_event_id UUID DEFAULT NULL,
    p_shared_permissions JSONB DEFAULT '{"shareEmail": true, "shareLinkedin": true}'::jsonb
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    connection_id UUID
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_conn_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Authentication required to swap digital business cards.', NULL::UUID;
        RETURN;
    END IF;

    IF v_actor_id = p_target_user_id THEN
        RETURN QUERY SELECT FALSE, 'Cannot create a business card connection with yourself.', NULL::UUID;
        RETURN;
    END IF;

    -- Insert or ignore mutual connection
    INSERT INTO public.user_connections (
        user_id_1,
        user_id_2,
        met_at_event_id,
        shared_permissions
    )
    VALUES (
        LEAST(v_actor_id, p_target_user_id),
        GREATEST(v_actor_id, p_target_user_id),
        p_event_id,
        p_shared_permissions
    )
    ON CONFLICT (user_id_1, user_id_2) DO UPDATE
    SET shared_permissions = EXCLUDED.shared_permissions,
        met_at_event_id = COALESCE(EXCLUDED.met_at_event_id, public.user_connections.met_at_event_id)
    RETURNING id INTO v_conn_id;

    RETURN QUERY SELECT TRUE, 'Digital business card swapped successfully!', v_conn_id;
END;
$$;
