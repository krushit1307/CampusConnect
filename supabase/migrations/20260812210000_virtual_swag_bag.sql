-- Migration: 20260812210000_virtual_swag_bag.sql
-- Description: Create swag_items and swag_unique_codes tables,
--               attendance-gated RLS policies (status = 'attended'),
--               and transactional claim_unique_swag_code RPC function (#3008).

-- 1. Create swag_items table
CREATE TABLE IF NOT EXISTS public.swag_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sponsor_name TEXT NOT NULL,
    generic_code TEXT, -- Present if static code (e.g. NOTIONPRO2026)
    link_url TEXT,
    image_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create swag_unique_codes table for single-use CSV codes
CREATE TABLE IF NOT EXISTS public.swag_unique_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swag_item_id UUID REFERENCES public.swag_items(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    UNIQUE (swag_item_id, code)
);

-- Enable RLS
ALTER TABLE public.swag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swag_unique_codes ENABLE ROW LEVEL SECURITY;

-- Attendance-Gated RLS Policy: Users can ONLY select swag items if they physically checked in (status = 'attended')
CREATE POLICY "Attendees with verified check-in can view swag items"
    ON public.swag_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.event_rsvps r
            WHERE r.event_id = swag_items.event_id
              AND r.user_id = auth.uid()
              AND r.status = 'attended'
        )
    );

CREATE POLICY "Attendees with verified check-in can view unique swag codes"
    ON public.swag_unique_codes FOR SELECT
    USING (
        claimed_by_user_id = auth.uid()
    );

-- 3. Transactional RPC for claiming single-use unique codes without race conditions
CREATE OR REPLACE FUNCTION public.claim_unique_swag_code(
    p_swag_item_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    code TEXT,
    message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
    v_attended BOOLEAN := FALSE;
    v_existing_code TEXT;
    v_target_code_id UUID;
    v_claimed_code TEXT;
BEGIN
    -- Verify event_id for this swag item
    SELECT event_id INTO v_event_id FROM public.swag_items WHERE id = p_swag_item_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Swag item not found.';
        RETURN;
    END IF;

    -- Verify physical attendance check-in (status = 'attended')
    SELECT EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE event_id = v_event_id AND user_id = p_user_id AND status = 'attended'
    ) INTO v_attended;

    IF NOT v_attended THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'Swag bag access is restricted to verified event attendees.';
        RETURN;
    END IF;

    -- Check if user already claimed a code for this swag item
    SELECT c.code INTO v_existing_code
    FROM public.swag_unique_codes c
    WHERE c.swag_item_id = p_swag_item_id AND c.claimed_by_user_id = p_user_id;

    IF v_existing_code IS NOT NULL THEN
        RETURN QUERY SELECT TRUE, v_existing_code, 'Swag code already claimed.';
        RETURN;
    END IF;

    -- Atomically lock and claim 1 available unique code (FOR UPDATE SKIP LOCKED)
    SELECT c.id, c.code INTO v_target_code_id, v_claimed_code
    FROM public.swag_unique_codes c
    WHERE c.swag_item_id = p_swag_item_id AND c.claimed_by_user_id IS NULL
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_target_code_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 'All unique promo codes for this item have been claimed.';
        RETURN;
    END IF;

    -- Assign code to user
    UPDATE public.swag_unique_codes
    SET claimed_by_user_id = p_user_id, claimed_at = NOW()
    WHERE id = v_target_code_id;

    RETURN QUERY SELECT TRUE, v_claimed_code, 'Swag promo code claimed successfully!';
END;
$$;
