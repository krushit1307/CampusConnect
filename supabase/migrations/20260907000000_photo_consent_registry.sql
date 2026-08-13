-- Migration: 20260907000000_photo_consent_registry.sql
-- Description: Issue #3138 - Photo Consent Registry & Media Release Enforcement

-- 1. Consent records.
--    Scopes are modelled separately rather than as a single allow_photos flag:
--    somebody who is happy to appear in a members-only club gallery should not
--    be forced to accept press use as the price of that, because the result is
--    that they opt out of everything instead.
CREATE TABLE IF NOT EXISTS public.photo_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (
        scope IN ('INTERNAL_GALLERY', 'PUBLIC_WEBSITE', 'SOCIAL_MEDIA', 'PRESS_MARKETING')
    ),
    decision TEXT NOT NULL CHECK (decision IN ('GRANTED', 'DENIED')),
    level TEXT NOT NULL DEFAULT 'ACCOUNT' CHECK (level IN ('ACCOUNT', 'EVENT')),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Media releases lapse, typically at the end of an academic year.
    expires_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    withdrawn_reason TEXT,
    -- An event-level record must name its event; an account-level one must not.
    CONSTRAINT photo_consent_level_matches_event CHECK (
        (level = 'EVENT' AND event_id IS NOT NULL)
        OR (level = 'ACCOUNT' AND event_id IS NULL)
    ),
    CONSTRAINT photo_consent_expiry_after_record CHECK (
        expires_at IS NULL OR expires_at > recorded_at
    )
);

-- One live record per user, scope and level. Event-level records are unique
-- per event; account-level records are unique per scope.
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_consent_account_unique
    ON public.photo_consent_records (user_id, scope)
    WHERE level = 'ACCOUNT';

CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_consent_event_unique
    ON public.photo_consent_records (user_id, scope, event_id)
    WHERE level = 'EVENT';

CREATE INDEX IF NOT EXISTS idx_photo_consent_expiring
    ON public.photo_consent_records (expires_at)
    WHERE decision = 'GRANTED' AND withdrawn_at IS NULL;

-- 2. Append-only history. "What did we believe at the time we published?" is
--    the question that matters if a decision is ever challenged, and the
--    current-state table alone cannot answer it.
CREATE TABLE IF NOT EXISTS public.photo_consent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_record_id UUID REFERENCES public.photo_consent_records(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    decision TEXT NOT NULL,
    level TEXT NOT NULL,
    event_id UUID,
    action TEXT NOT NULL CHECK (action IN ('GRANTED', 'DENIED', 'WITHDRAWN', 'EXPIRED', 'RENEWED')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_consent_history_user
    ON public.photo_consent_history (user_id, scope, changed_at DESC);

-- 3. Assets already published under a given scope. Withdrawal turns rows here
--    into redaction work, so the obligation is visible rather than silently
--    accruing.
CREATE TABLE IF NOT EXISTS public.published_photo_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (
        scope IN ('INTERNAL_GALLERY', 'PUBLIC_WEBSITE', 'SOCIAL_MEDIA', 'PRESS_MARKETING')
    ),
    location TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    redacted_at TIMESTAMPTZ,
    CONSTRAINT published_photo_assets_unique UNIQUE (photo_id, user_id, scope, location)
);

CREATE INDEX IF NOT EXISTS idx_published_assets_pending_redaction
    ON public.published_photo_assets (user_id, scope)
    WHERE redacted_at IS NULL;

-- 4. Consent evaluation, mirroring evaluateConsent() in src/lib/photoConsent.ts.
--    Precedence: withdrawal, then explicit denial, then event grant, then
--    account grant, then lapsed grant, then the scope default. Only the
--    members-only gallery is permitted in the absence of a record.
CREATE OR REPLACE FUNCTION public.evaluate_photo_consent(
    p_user_id UUID,
    p_scope TEXT,
    p_event_id UUID DEFAULT NULL,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_applicable RECORD;
BEGIN
    -- A withdrawal always wins.
    IF EXISTS (
        SELECT 1 FROM public.photo_consent_records r
        WHERE r.user_id = p_user_id AND r.scope = p_scope
          AND r.withdrawn_at IS NOT NULL AND r.withdrawn_at <= p_now
          AND (r.level = 'ACCOUNT' OR r.event_id IS NOT DISTINCT FROM p_event_id)
    ) THEN
        RETURN QUERY SELECT FALSE, 'WITHDRAWN'::TEXT;
        RETURN;
    END IF;

    -- An explicit denial beats a grant at any level.
    IF EXISTS (
        SELECT 1 FROM public.photo_consent_records r
        WHERE r.user_id = p_user_id AND r.scope = p_scope AND r.decision = 'DENIED'
          AND (r.level = 'ACCOUNT' OR r.event_id IS NOT DISTINCT FROM p_event_id)
    ) THEN
        RETURN QUERY SELECT FALSE, 'EXPLICIT_DENIAL'::TEXT;
        RETURN;
    END IF;

    -- An event-level grant overrides the account-level default.
    IF p_event_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.photo_consent_records r
        WHERE r.user_id = p_user_id AND r.scope = p_scope AND r.decision = 'GRANTED'
          AND r.level = 'EVENT' AND r.event_id = p_event_id
          AND (r.expires_at IS NULL OR r.expires_at > p_now)
    ) THEN
        RETURN QUERY SELECT TRUE, 'EVENT_GRANT'::TEXT;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.photo_consent_records r
        WHERE r.user_id = p_user_id AND r.scope = p_scope AND r.decision = 'GRANTED'
          AND r.level = 'ACCOUNT'
          AND (r.expires_at IS NULL OR r.expires_at > p_now)
    ) THEN
        RETURN QUERY SELECT TRUE, 'ACCOUNT_GRANT'::TEXT;
        RETURN;
    END IF;

    -- A lapsed grant is the same as no release; it must not fall back to a
    -- permissive default.
    IF EXISTS (
        SELECT 1 FROM public.photo_consent_records r
        WHERE r.user_id = p_user_id AND r.scope = p_scope AND r.decision = 'GRANTED'
          AND r.expires_at IS NOT NULL AND r.expires_at <= p_now
          AND (r.level = 'ACCOUNT' OR r.event_id IS NOT DISTINCT FROM p_event_id)
    ) THEN
        RETURN QUERY SELECT FALSE, 'EXPIRED'::TEXT;
        RETURN;
    END IF;

    IF p_scope = 'INTERNAL_GALLERY' THEN
        RETURN QUERY SELECT TRUE, 'DEFAULT_ALLOW'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'DEFAULT_DENY'::TEXT;
    END IF;
END;
$$;

-- 5. Withdraw consent and return the assets that now need redacting.
CREATE OR REPLACE FUNCTION public.withdraw_photo_consent(
    p_scope TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (asset_id UUID, photo_id UUID, location TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.photo_consent_records
    SET withdrawn_at = NOW(),
        withdrawn_reason = p_reason
    WHERE user_id = auth.uid()
      AND scope = p_scope
      AND withdrawn_at IS NULL;

    INSERT INTO public.photo_consent_history (user_id, scope, decision, level, action)
    VALUES (auth.uid(), p_scope, 'DENIED', 'ACCOUNT', 'WITHDRAWN');

    -- Withdrawal must also drop any existing face tags, since the tag row
    -- existing at all is the harm for somebody opting out on safeguarding
    -- grounds.
    DELETE FROM public.photo_tags t
    WHERE t.user_id = auth.uid()
      AND EXISTS (
          SELECT 1 FROM public.published_photo_assets a
          WHERE a.photo_id = t.photo_id
            AND a.user_id = t.user_id
            AND a.scope = p_scope
      );

    RETURN QUERY
    SELECT a.id, a.photo_id, a.location
    FROM public.published_photo_assets a
    WHERE a.user_id = auth.uid()
      AND a.scope = p_scope
      AND a.redacted_at IS NULL
    ORDER BY a.published_at;
END;
$$;

-- 6. Record every state change into the append-only history.
CREATE OR REPLACE FUNCTION public.log_photo_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.photo_consent_history (
        consent_record_id, user_id, scope, decision, level, event_id, action
    )
    VALUES (
        NEW.id, NEW.user_id, NEW.scope, NEW.decision, NEW.level, NEW.event_id,
        CASE
            WHEN NEW.withdrawn_at IS NOT NULL
                 AND (TG_OP = 'INSERT' OR OLD.withdrawn_at IS NULL) THEN 'WITHDRAWN'
            WHEN TG_OP = 'UPDATE' AND NEW.decision = 'GRANTED' AND OLD.decision = 'GRANTED' THEN 'RENEWED'
            ELSE NEW.decision
        END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_photo_consent_change ON public.photo_consent_records;
CREATE TRIGGER trg_log_photo_consent_change
    AFTER INSERT OR UPDATE ON public.photo_consent_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_photo_consent_change();

-- 7. Releases lapsing soon, so students can be asked to renew before their
--    photos silently drop out of use.
CREATE OR REPLACE FUNCTION public.get_expiring_photo_consents(p_within_days INTEGER DEFAULT 30)
RETURNS TABLE (consent_id UUID, user_id UUID, scope TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT r.id, r.user_id, r.scope, r.expires_at
    FROM public.photo_consent_records r
    WHERE r.decision = 'GRANTED'
      AND r.withdrawn_at IS NULL
      AND r.expires_at IS NOT NULL
      AND r.expires_at > NOW()
      AND r.expires_at <= NOW() + (p_within_days || ' days')::INTERVAL
    ORDER BY r.expires_at ASC;
$$;

-- 8. Row level security. Consent is personal data: a person's own decisions
--    are theirs to read and change, and nobody else's to browse.
ALTER TABLE public.photo_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_photo_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own consent" ON public.photo_consent_records;
CREATE POLICY "Users manage their own consent"
    ON public.photo_consent_records FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read their own consent history" ON public.photo_consent_history;
CREATE POLICY "Users read their own consent history"
    ON public.photo_consent_history FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read their own published assets" ON public.published_photo_assets;
CREATE POLICY "Users read their own published assets"
    ON public.published_photo_assets FOR SELECT
    USING (user_id = auth.uid());

COMMENT ON TABLE public.photo_consent_records IS
    'Per-scope photo and media release consent. Absence of a record denies every outward-facing scope (#3138).';
COMMENT ON TABLE public.photo_consent_history IS
    'Append-only consent history, used to answer what was believed at the moment of publication.';
