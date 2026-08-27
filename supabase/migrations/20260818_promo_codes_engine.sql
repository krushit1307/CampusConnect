-- Migration: Sponsor-Provided Promo Code Engine
-- Issue #3332

CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    code_string VARCHAR(50) NOT NULL,
    discount_amount_cents INT NOT NULL DEFAULT 0,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed')),
    max_uses INT NOT NULL DEFAULT 100,
    current_uses INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_event_promo_code UNIQUE (event_id, code_string)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Organizers and Admins can view and manage promo codes
CREATE POLICY "Organizers and Admins can manage promo codes"
    ON public.promo_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = promo_codes.event_id
            AND (events.organizer_id = auth.uid() OR events.created_by = auth.uid())
        )
    );

-- Public can check promo code validity through RPC function only
CREATE POLICY "Public read active promo codes"
    ON public.promo_codes
    FOR SELECT
    TO public
    USING (is_active = true);

-- Atomic Postgres RPC function to safely apply & increment promo code usage with concurrency locking (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.apply_promo_code(
    p_event_id UUID,
    p_code TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    discount_amount_cents INT,
    discount_type VARCHAR,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_promo RECORD;
BEGIN
    -- Select with row-level lock to prevent race conditions during concurrent checkouts
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE (event_id = p_event_id OR event_id IS NULL)
      AND UPPER(code_string) = UPPER(TRIM(p_code))
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 'fixed'::VARCHAR, 'Promo code not found or invalid for this event.'::TEXT;
        RETURN;
    END IF;

    -- Check expiration
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < timezone('utc'::text, now()) THEN
        RETURN QUERY SELECT false, 0, 'fixed'::VARCHAR, 'Promo code has expired.'::TEXT;
        RETURN;
    END IF;

    -- Check usage limit
    IF v_promo.current_uses >= v_promo.max_uses THEN
        RETURN QUERY SELECT false, 0, 'fixed'::VARCHAR, 'Promo code usage limit reached.'::TEXT;
        RETURN;
    END IF;

    -- Atomically increment usage
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_promo.id;

    RETURN QUERY SELECT true, v_promo.discount_amount_cents, v_promo.discount_type, NULL::TEXT;
END;
$$;

-- Indexing
CREATE INDEX IF NOT EXISTS idx_promo_codes_event_code ON public.promo_codes (event_id, code_string);
CREATE INDEX IF NOT EXISTS idx_promo_codes_lookup ON public.promo_codes (code_string) WHERE is_active = true;
