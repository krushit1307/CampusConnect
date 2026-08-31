-- Migration: 20280904000000_honeypot_fingerprinting.sql
-- Description: Add Honey Pot support to ticket tiers and overload validation RPC to handle fingerprint tarpitting

-- 1. Add is_honeypot column to ticket_tiers
ALTER TABLE public.ticket_tiers
ADD COLUMN IF NOT EXISTS is_honeypot BOOLEAN DEFAULT false;

-- 2. Overload validate_unlock_hash to accept client info and trap honeypot hits
CREATE OR REPLACE FUNCTION public.validate_unlock_hash(
    p_event_id UUID,
    p_unlock_hash TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
    tier_id UUID,
    tier_name TEXT,
    tier_price INT,
    tier_capacity INT,
    uses_remaining INT,
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier RECORD;
    v_tarpit_session_id UUID;
BEGIN
    -- Find the secret tier with matching unlock hash
    SELECT 
        t.id,
        t.name,
        t.price,
        t.capacity,
        t.uses_remaining,
        t.secret_expires_at,
        t.is_honeypot
    INTO v_tier
    FROM public.ticket_tiers t
    WHERE t.event_id = p_event_id
      AND t.unlock_hash = p_unlock_hash
      AND t.is_secret = TRUE
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, FALSE::BOOLEAN;
        RETURN;
    END IF;

    -- Check if it is a Honey Pot link
    IF v_tier.is_honeypot = TRUE THEN
        -- Trap device fingerprint and IP address in the tarpit!
        IF p_ip_address IS NOT NULL OR p_fingerprint IS NOT NULL THEN
            SELECT public.start_tarpit_session(
                COALESCE(p_ip_address, 'unknown'),
                p_user_agent,
                p_fingerprint,
                'aggressive',
                'honeypot_trap'
            ) INTO v_tarpit_session_id;
        END IF;

        -- Return invalid immediately to mock non-existent link
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, FALSE::BOOLEAN;
        RETURN;
    END IF;
    
    -- Check if secret tier has expired
    IF v_tier.secret_expires_at IS NOT NULL AND v_tier.secret_expires_at < NOW() THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, FALSE::BOOLEAN;
        RETURN;
    END IF;
    
    -- Check if uses remaining
    IF v_tier.uses_remaining IS NOT NULL AND v_tier.uses_remaining <= 0 THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::INT, NULL::INT, NULL::INT, FALSE::BOOLEAN;
        RETURN;
    END IF;
    
    -- Valid secret tier found
    RETURN QUERY 
    SELECT 
        v_tier.id,
        v_tier.name,
        v_tier.price,
        v_tier.capacity,
        v_tier.uses_remaining,
        TRUE::BOOLEAN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_unlock_hash(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
