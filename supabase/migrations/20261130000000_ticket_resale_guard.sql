-- =============================================================================
-- Migration: Ticket Resale Price Cap & Anti-Scalping Guard
-- Description: Adds a per-event resale policy, a log of every transfer attempt
--              with the decision it received, and the counters the guard needs
--              to judge velocity. Enforcement lives in the application layer so
--              the browser and the server apply exactly the same rules.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resale_price_cap_mode') THEN
        CREATE TYPE public.resale_price_cap_mode AS ENUM (
            'face_value',
            'percentage',
            'fixed_ceiling',
            'free_only'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_decision') THEN
        CREATE TYPE public.transfer_decision AS ENUM ('allow', 'review', 'block');
    END IF;
END$$;

-- 1. Policy ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_resale_policies (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    cap_mode public.resale_price_cap_mode NOT NULL DEFAULT 'face_value',
    -- Percent uplift for 'percentage', cents for 'fixed_ceiling'.
    cap_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cooldown_hours SMALLINT NOT NULL DEFAULT 24,
    max_transfers_per_ticket SMALLINT NOT NULL DEFAULT 2,
    max_resales_per_seller SMALLINT NOT NULL DEFAULT 2,
    review_risk_threshold SMALLINT NOT NULL DEFAULT 50,
    final_hours_review_window SMALLINT NOT NULL DEFAULT 6,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_resale_policies_cap_value_positive CHECK (cap_value >= 0),
    CONSTRAINT event_resale_policies_cooldown_range CHECK (cooldown_hours BETWEEN 0 AND 720),
    CONSTRAINT event_resale_policies_threshold_range CHECK (review_risk_threshold BETWEEN 0 AND 100),
    CONSTRAINT event_resale_policies_transfer_limits CHECK (
        max_transfers_per_ticket >= 0 AND max_resales_per_seller >= 0
    )
);

-- 2. Attempt log -------------------------------------------------------------
--
-- Every attempt is recorded, successful or not. An organiser who can see the
-- pressure on their event can respond to it; a blocked attempt that leaves no
-- trace teaches nobody anything.
CREATE TABLE IF NOT EXISTS public.ticket_transfer_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL,
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    asking_price_cents BIGINT NOT NULL DEFAULT 0,
    decision public.transfer_decision NOT NULL,
    risk_score SMALLINT NOT NULL DEFAULT 0,
    -- Machine readable codes, e.g. {price_above_cap,cooldown_active}.
    violations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ticket_transfer_attempts_price_positive CHECK (asking_price_cents >= 0),
    CONSTRAINT ticket_transfer_attempts_risk_range CHECK (risk_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_transfer_attempts_event
    ON public.ticket_transfer_attempts (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_attempts_seller_recent
    ON public.ticket_transfer_attempts (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_attempts_ticket
    ON public.ticket_transfer_attempts (ticket_id, created_at DESC);

-- 3. Held ticket history -----------------------------------------------------
--
-- Who has held a ticket, so a ticket cannot be laundered back to an account
-- that has already had it.
CREATE TABLE IF NOT EXISTS public.ticket_holder_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    holder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    held_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    held_until TIMESTAMPTZ,
    CONSTRAINT ticket_holder_history_unique UNIQUE (ticket_id, holder_id, held_from)
);

CREATE INDEX IF NOT EXISTS idx_ticket_holder_history_ticket
    ON public.ticket_holder_history (ticket_id);

-- 4. Velocity counters -------------------------------------------------------
--
-- The guard needs these three numbers for every decision, and reading them
-- from one function keeps the browser and the server in step.
CREATE OR REPLACE FUNCTION public.seller_transfer_stats(
    p_seller_id UUID,
    p_event_id UUID
)
RETURNS TABLE (
    resales_this_event INT,
    transfers_last_24h INT,
    tickets_held_for_event INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        (
            SELECT COUNT(*)::INT
            FROM public.ticket_transfer_attempts a
            WHERE a.seller_id = p_seller_id
              AND a.event_id = p_event_id
              AND a.decision = 'allow'
              AND a.completed_at IS NOT NULL
        ),
        (
            SELECT COUNT(*)::INT
            FROM public.ticket_transfer_attempts a
            WHERE a.seller_id = p_seller_id
              AND a.completed_at > NOW() - INTERVAL '24 hours'
        ),
        (
            SELECT COUNT(*)::INT
            FROM public.ticket_holder_history h
            JOIN public.ticket_transfer_attempts a ON a.ticket_id = h.ticket_id
            WHERE h.holder_id = p_seller_id
              AND h.held_until IS NULL
              AND a.event_id = p_event_id
        );
$$;

GRANT EXECUTE ON FUNCTION public.seller_transfer_stats(UUID, UUID) TO authenticated;

-- 5. Row level security ------------------------------------------------------

ALTER TABLE public.event_resale_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transfer_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_holder_history ENABLE ROW LEVEL SECURITY;

-- The cap has to be public: a buyer cannot agree to a price without knowing
-- the ceiling it is measured against.
DROP POLICY IF EXISTS "Anyone can read the resale policy" ON public.event_resale_policies;
CREATE POLICY "Anyone can read the resale policy"
ON public.event_resale_policies FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Organisers set the resale policy" ON public.event_resale_policies;
CREATE POLICY "Organisers set the resale policy"
ON public.event_resale_policies FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_resale_policies.event_id
          AND (e.created_by = auth.uid() OR public.is_club_admin(e.club_id, auth.uid()))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_resale_policies.event_id
          AND (e.created_by = auth.uid() OR public.is_club_admin(e.club_id, auth.uid()))
    )
);

DROP POLICY IF EXISTS "Participants see their own attempts" ON public.ticket_transfer_attempts;
CREATE POLICY "Participants see their own attempts"
ON public.ticket_transfer_attempts FOR SELECT
USING (
    seller_id = auth.uid()
    OR buyer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = ticket_transfer_attempts.event_id
          AND (e.created_by = auth.uid() OR public.is_club_admin(e.club_id, auth.uid()))
    )
);

DROP POLICY IF EXISTS "Sellers log their own attempts" ON public.ticket_transfer_attempts;
CREATE POLICY "Sellers log their own attempts"
ON public.ticket_transfer_attempts FOR INSERT
WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Holders see ticket history" ON public.ticket_holder_history;
CREATE POLICY "Holders see ticket history"
ON public.ticket_holder_history FOR SELECT
USING (holder_id = auth.uid());

-- 6. Default policy for new ticketed events ----------------------------------
--
-- Events start capped at face value rather than uncapped, because an event
-- that nobody has configured is exactly the one that gets flipped.
CREATE OR REPLACE FUNCTION public.ensure_default_resale_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.event_resale_policies (event_id)
    VALUES (NEW.id)
    ON CONFLICT (event_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_default_resale_policy ON public.events;
CREATE TRIGGER trg_ensure_default_resale_policy
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_resale_policy();
