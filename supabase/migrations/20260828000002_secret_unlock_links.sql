-- ============================================================
-- Migration: 20260828000002_secret_unlock_links.sql
-- Issue: #4672 - Dynamic "Early Bird" Secret Unlock Links
-- Description: 
--   1. Adds secret tier fields to ticket_tiers table
--   2. Creates secret unlock hash generation and validation functions
--   3. Adds uses_remaining tracking for secret links
--   4. Creates RPCs for secret tier management
-- ============================================================

SET lock_timeout = '3s';

-- 1. Add secret tier fields to ticket_tiers table
ALTER TABLE public.ticket_tiers
ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unlock_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS uses_remaining INT,
ADD COLUMN IF NOT EXISTS max_uses INT,
ADD COLUMN IF NOT EXISTS secret_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS secret_expires_at TIMESTAMPTZ;

-- Add constraints for secret tiers
ALTER TABLE public.ticket_tiers
ADD CONSTRAINT chk_secret_tier_consistency
CHECK (
    NOT is_secret OR 
    (unlock_hash IS NOT NULL AND max_uses IS NOT NULLAND uses_remaining IS NOT NULL)
);

ALTER TABLE public.ticket_tiers
ADD CONSTRAINT chk_uses_remaining_valid
CHECK (
    uses_remaining IS NULL OR uses_remaining >= 0
);

COMMENT ON COLUMN public.ticket_tiers.is_secret IS 'Whether this tier is hidden from public UI and requires secret unlock hash';
COMMENT ON COLUMN public.ticket_tiers.unlock_hash IS 'Cryptographic hash that unlocks this secret tier';
COMMENT ON COLUMN public.ticket_tiers.uses_remaining IS 'Number of remaining uses for this secret tier link';
COMMENT ON COLUMN public.ticket_tiers.max_uses IS 'Maximum number of uses allowed for this secret tier link';
COMMENT ON COLUMN public.ticket_tiers.secret_created_at IS 'Timestamp when secret tier was created';
COMMENT ON COLUMN public.ticket_tiers.secret_expires_at IS 'Optional expiration timestamp for secret tier access';

-- 2. Create function to generate cryptographically secure unlock hash
CREATE OR REPLACE FUNCTION public.generate_unlock_hash(p_event_id UUID, p_tier_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_random_bytes BYTEA;
    v_hash TEXT;
    v_base64 TEXT;
BEGIN
    -- Generate 32 random bytes (256 bits)
    v_random_bytes := gen_random_bytes(32);
    
    -- Encode as base64 and remove padding
    v_base64 := encode(v_random_bytes, 'base64');
    v_base64 := regexp_replace(v_base64, '=+$', '');
    
    -- Create a more readable hash by replacing +/ with safe characters
    v_hash := regexp_replace(v_base64, '\+', '-', 'g');
    v_hash := regexp_replace(v_hash, '/', '_', 'g');
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.ticket_tiers WHERE unlock_hash = v_hash) LOOP
        v_random_bytes := gen_random_bytes(32);
        v_base64 := encode(v_random_bytes, 'base64');
        v_base64 := regexp_replace(v_base64, '=+$', '');
        v_hash := regexp_replace(v_base64, '\+', '-', 'g');
        v_hash := regexp_replace(v_hash, '/', '_', 'g');
    END LOOP;
    
    RETURN v_hash;
END;
$$;

-- 3. Create function to validate unlock hash and return secret tier
CREATE OR REPLACE FUNCTION public.validate_unlock_hash(p_event_id UUID, p_unlock_hash TEXT)
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
BEGIN
    -- Find the secret tier with matching unlock hash
    SELECT 
        t.id,
        t.name,
        t.price,
        t.capacity,
        t.uses_remaining,
        t.secret_expires_at
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

-- 4. Create RPC to create a secret tier
CREATE OR REPLACE FUNCTION public.create_secret_tier(
    p_event_id UUID,
    p_name TEXT,
    p_price INT,
    p_capacity INT,
    p_max_uses INT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_unlock_hash TEXT;
    v_tier_id UUID;
BEGIN
    -- Validate inputs
    IF p_max_uses IS NULL OR p_max_uses <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'max_uses must be greater than 0');
    END IF;
    
    IF p_name IS NULL OR p_name = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tier name is required');
    END IF;
    
    -- Generate unlock hash
    v_unlock_hash := public.generate_unlock_hash(p_event_id, p_name);
    
    -- Create secret tier
    INSERT INTO public.ticket_tiers (
        event_id,
        name,
        price,
        capacity,
        is_secret,
        unlock_hash,
        uses_remaining,
        max_uses,
        secret_created_at,
        secret_expires_at,
        description,
        start_date,
        end_date
    ) VALUES (
        p_event_id,
        p_name,
        p_price,
        p_capacity,
        TRUE,
        v_unlock_hash,
        p_max_uses,
        p_max_uses,
        NOW(),
        p_expires_at,
        p_description,
        p_start_date,
        p_end_date
    ) RETURNING id INTO v_tier_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'tier_id', v_tier_id,
        'unlock_hash', v_unlock_hash,
        'unlock_url', '/events/' || p_event_id || '?unlock_hash=' || v_unlock_hash,
        'message', 'Secret tier created successfully'
    );
END;
$$;

-- 5. Create RPC to get all ticket tiers including secret ones (for organizers)
CREATE OR REPLACE FUNCTION public.get_all_ticket_tiers(p_event_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    price INT,
    capacity INT,
    is_secret BOOLEAN,
    unlock_hash TEXT,
    uses_remaining INT,
    max_uses INT,
    secret_expires_at TIMESTAMPTZ,
    sold_count INT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.price,
        t.capacity,
        t.is_secret,
        t.unlock_hash,
        t.uses_remaining,
        t.max_uses,
        t.secret_expires_at,
        (SELECT count(*)::int FROM public.event_rsvps r WHERE r.ticket_tier_id = t.id) as sold_count,
        t.start_date,
        t.end_date
    FROM public.ticket_tiers t
    WHERE t.event_id = p_event_id
    ORDER BY t.is_secret ASC, t.start_date ASC NULLS LAST;
END;
$$;

-- 6. Create RPC to decrement uses_remaining when a secret tier is purchased
CREATE OR REPLACE FUNCTION public.record_secret_tier_purchase(p_tier_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uses_remaining INT;
BEGIN
    -- Decrement uses_remaining atomically
    UPDATE public.ticket_tiers
    SET uses_remaining = uses_remaining - 1
    WHERE id = p_tier_id
      AND is_secret = TRUE
      AND uses_remaining > 0
    RETURNING uses_remaining INTO v_uses_remaining;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Secret tier not found or no uses remaining');
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'uses_remaining', v_uses_remaining,
        'message', 'Secret tier purchase recorded'
    );
END;
$$;

-- 7. Create RPC to get public ticket tiers (excludes secret tiers)
CREATE OR REPLACE FUNCTION public.get_public_ticket_tiers(p_event_id UUID, p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
    id UUID,
    name TEXT,
    price INT,
    capacity INT,
    sold_count INT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    discount_rules JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH TierStats AS (
        SELECT 
            t.id,
            t.name,
            t.price,
            t.capacity,
            t.start_date,
            t.end_date,
            t.discount_rules,
            (SELECT count(*)::int FROM public.event_rsvps r WHERE r.ticket_tier_id = t.id) as sold_count
        FROM public.ticket_tiers t
        WHERE t.event_id = p_event_id
          AND t.is_secret = FALSE  -- Exclude secret tiers
    )
    SELECT 
        ts.id,
        ts.name,
        ts.price,
        ts.capacity,
        ts.sold_count,
        ts.start_date,
        ts.end_date,
        ts.discount_rules
    FROM TierStats ts
    WHERE (ts.start_date IS NULL OR p_now >= ts.start_date)
      AND (ts.end_date IS NULL OR p_now < ts.end_date)
      AND (ts.capacity IS NULL OR ts.sold_count < ts.capacity)
    ORDER BY ts.start_date ASC NULLS LAST;
END;
$$;

-- 8. Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.create_secret_tier(UUID, TEXT, INT, INT, INT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_unlock_hash(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_all_ticket_tiers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_secret_tier_purchase(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_ticket_tiers(UUID, TIMESTAMPTZ) TO authenticated, anon;
