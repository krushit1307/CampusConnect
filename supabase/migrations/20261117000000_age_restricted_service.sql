-- Migration: 20261117000000_age_restricted_service.sql
-- Description: Issue #3398 - Age-restricted event service compliance
--
-- events.alcohol_present (20260810000094_event_co_signers) is a boolean that
-- routes an event to an approver and then does nothing. This adds what happens
-- after the approval: the ID check, the band, the certified server, the
-- service window, and the evidence that any of it took place.

-- 1. Per-event configuration.
--
--    Three modes rather than one flag. MIXED_AGE_SERVICE is where most student
--    events actually live -- all ages admitted, service restricted -- and it is
--    the case a boolean cannot express at all.
CREATE TABLE IF NOT EXISTS public.event_service_compliance (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'NONE' CHECK (
        mode IN ('NONE', 'AGE_RESTRICTED_VENUE', 'MIXED_AGE_SERVICE')
    ),
    minimum_age INTEGER NOT NULL DEFAULT 21 CHECK (minimum_age BETWEEN 16 AND 25),
    -- Offsets from the event end rather than absolute times, so rescheduling
    -- the event moves the cutoff with it. A cutoff that stays put while the
    -- event moves is worse than none, because it looks correct.
    last_call_minutes_before_end INTEGER NOT NULL DEFAULT 30 CHECK (last_call_minutes_before_end >= 0),
    hard_stop_minutes_before_end INTEGER NOT NULL DEFAULT 15 CHECK (hard_stop_minutes_before_end >= 0),
    drinks_per_attendee_cap INTEGER CHECK (drinks_per_attendee_cap IS NULL OR drinks_per_attendee_cap > 0),
    attendees_per_certified_server INTEGER NOT NULL DEFAULT 75
        CHECK (attendees_per_certified_server > 0),
    -- The parameters the approval was granted against, so a materially changed
    -- event can be detected rather than riding an approval nobody gave it.
    approved_attendance INTEGER,
    approved_venue_id UUID,
    approved_end_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT service_last_call_after_hard_stop CHECK (
        last_call_minutes_before_end >= hard_stop_minutes_before_end
    )
);

-- 2. The ID check.
--
--    Note what is absent: there is no date_of_birth column, deliberately. The
--    outcome is the fact worth keeping. Copying a DOB onto a row for every
--    event a student attends builds a standing personal-data liability to
--    answer a question that only ever needs a yes or no at one moment.
CREATE TABLE IF NOT EXISTS public.attendee_age_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (
        method IN ('GOVERNMENT_ID', 'PASSPORT', 'CAMPUS_ID_WITH_DOB', 'PREVIOUSLY_VERIFIED')
    ),
    band TEXT NOT NULL CHECK (band IN ('UNDER_AGE', 'OF_AGE')),
    verified_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, attendee_id)
);

CREATE INDEX IF NOT EXISTS idx_age_verification_event
    ON public.attendee_age_verifications (event_id, band);

-- 3. The band actually handed over. Separate from the verification because
--    reconciling the two is the whole point: a service band with no ID check
--    behind it is the anomaly worth finding, and it is invisible if the two
--    are the same row.
CREATE TABLE IF NOT EXISTS public.issued_wristbands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('NONE', 'ENTRY_ONLY', 'SERVICE_PERMITTED')),
    issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    CONSTRAINT wristband_void_has_reason CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wristband_live_unique
    ON public.issued_wristbands (event_id, attendee_id)
    WHERE voided_at IS NULL;

-- 4. Server certifications. These lapse, typically every three years, and an
--    expired card is not a qualification.
CREATE TABLE IF NOT EXISTS public.server_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    certification TEXT NOT NULL CHECK (
        certification IN ('TIPS', 'SERVSAFE_ALCOHOL', 'STATE_EQUIVALENT')
    ),
    certificate_number TEXT NOT NULL,
    issued_at DATE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, certification, certificate_number),
    CONSTRAINT certification_expires_after_issue CHECK (expires_at::DATE > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_server_certification_expiry
    ON public.server_certifications (expires_at);

-- 5. Who is rostered to serve at a given event.
CREATE TABLE IF NOT EXISTS public.event_service_roster (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_start TIMESTAMPTZ,
    shift_end TIMESTAMPTZ,
    PRIMARY KEY (event_id, user_id),
    CONSTRAINT roster_shift_ordered CHECK (
        shift_start IS NULL OR shift_end IS NULL OR shift_end > shift_start
    )
);

-- 6. Service log, for the drink cap and for the pattern of refusals.
CREATE TABLE IF NOT EXISTS public.service_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    served_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    decision TEXT NOT NULL CHECK (decision IN ('SERVE', 'REFUSE')),
    refusal_reason TEXT CHECK (
        refusal_reason IS NULL OR refusal_reason IN (
            'UNDER_AGE', 'NO_VERIFICATION', 'WRONG_BAND', 'OUTSIDE_SERVICE_WINDOW',
            'PAST_LAST_CALL', 'DRINK_CAP_REACHED', 'NO_CERTIFIED_SERVER'
        )
    ),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_refusal_has_reason CHECK (
        (decision = 'REFUSE') = (refusal_reason IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_service_event_attendee
    ON public.service_events (event_id, attendee_id)
    WHERE decision = 'SERVE';

-- 7. Whether service is open right now. Derived from the event end so it can
--    never disagree with the configured offsets.
CREATE OR REPLACE FUNCTION public.service_window_open(p_event_id UUID, p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT p_at >= e.start_date
       AND p_at < COALESCE(e.end_date, e.start_date)
                  - MAKE_INTERVAL(mins => c.hard_stop_minutes_before_end)
    FROM public.event_service_compliance c
    JOIN public.events e ON e.id = c.event_id
    WHERE c.event_id = p_event_id;
$$;

-- 8. Certified servers rostered for an event whose certification is still
--    valid on the event date. A card expiring the week before does not count.
CREATE OR REPLACE FUNCTION public.certified_server_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COUNT(DISTINCT r.user_id)::INTEGER
    FROM public.event_service_roster r
    JOIN public.events e ON e.id = r.event_id
    JOIN public.server_certifications s ON s.user_id = r.user_id
    WHERE r.event_id = p_event_id
      AND s.expires_at >= e.start_date;
$$;

-- 9. Reconciles bands handed out against ID checks recorded.
--
--    This is the report somebody has to be able to run afterwards. A service
--    band with no verification behind it is not a paperwork slip; it is the
--    thing that ends a liquor licence.
CREATE OR REPLACE FUNCTION public.reconcile_event_wristbands(p_event_id UUID)
RETURNS TABLE (attendee_id UUID, anomaly TEXT, detail TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    -- A live band with no ID check on record.
    SELECT w.attendee_id,
           'BAND_WITHOUT_VERIFICATION',
           w.tier || ' band issued at ' || w.issued_at
    FROM public.issued_wristbands w
    WHERE w.event_id = p_event_id
      AND w.voided_at IS NULL
      AND w.tier <> 'NONE'
      AND NOT EXISTS (
          SELECT 1 FROM public.attendee_age_verifications v
          WHERE v.event_id = w.event_id AND v.attendee_id = w.attendee_id
      )

    UNION ALL

    -- A service band held by somebody the check returned as under age.
    SELECT w.attendee_id,
           'SERVICE_BAND_FOR_UNDER_AGE',
           'Verified UNDER_AGE at ' || v.verified_at
    FROM public.issued_wristbands w
    JOIN public.attendee_age_verifications v
        ON v.event_id = w.event_id AND v.attendee_id = w.attendee_id
    WHERE w.event_id = p_event_id
      AND w.voided_at IS NULL
      AND w.tier = 'SERVICE_PERMITTED'
      AND v.band = 'UNDER_AGE'

    UNION ALL

    -- Checked and cleared, but never given a band, so they cannot be served.
    SELECT v.attendee_id,
           'VERIFIED_BUT_UNBANDED',
           'Verified OF_AGE at ' || v.verified_at
    FROM public.attendee_age_verifications v
    WHERE v.event_id = p_event_id
      AND v.band = 'OF_AGE'
      AND NOT EXISTS (
          SELECT 1 FROM public.issued_wristbands w
          WHERE w.event_id = v.event_id AND w.attendee_id = v.attendee_id
            AND w.voided_at IS NULL
      )

    ORDER BY 1, 2;
$$;

-- 10. Refuse a service band to somebody the ID check said is under age.
--
--     Enforced here rather than only at the point of issue because this is the
--     one mistake that cannot be walked back afterwards.
CREATE OR REPLACE FUNCTION public.enforce_wristband_matches_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_band TEXT;
BEGIN
    IF NEW.tier <> 'SERVICE_PERMITTED' THEN
        RETURN NEW;
    END IF;

    SELECT band INTO v_band
    FROM public.attendee_age_verifications
    WHERE event_id = NEW.event_id AND attendee_id = NEW.attendee_id;

    IF v_band IS NULL THEN
        RAISE EXCEPTION
            'A service band cannot be issued before an age verification is recorded'
            USING HINT = 'Record the ID check first, then issue the band.';
    END IF;

    IF v_band = 'UNDER_AGE' THEN
        RAISE EXCEPTION
            'A service band cannot be issued to an attendee verified as under age';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wristband_verification ON public.issued_wristbands;
CREATE TRIGGER trg_enforce_wristband_verification
    BEFORE INSERT ON public.issued_wristbands
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_wristband_matches_verification();

-- 11. Whether the approval still describes the event it was granted for.
--
--     An event approved at eighty attendees that has since grown to three
--     hundred is running on an approval nobody gave. The co-signer trigger
--     already re-fires when the underlying columns change; the compliance
--     verdict follows the same principle or it is a rubber stamp with a date.
CREATE OR REPLACE FUNCTION public.service_approval_stale(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        c.approved_at IS NOT NULL
        AND (
            (c.approved_attendance IS NOT NULL
             AND COALESCE(e.max_attendees, 0) > c.approved_attendance * 1.2)
         OR (c.approved_end_at IS NOT NULL
             AND COALESCE(e.end_date, e.start_date) > c.approved_end_at)
        )
    FROM public.event_service_compliance c
    JOIN public.events e ON e.id = c.event_id
    WHERE c.event_id = p_event_id;
$$;

-- 12. Row level security.
--
--     A verification record says something about a named person's age at a
--     named event. It belongs to the serving team and to an auditor, and to
--     nobody else.
ALTER TABLE public.attendee_age_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_wristbands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_service_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_service_compliance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees read their own verification"
    ON public.attendee_age_verifications;
CREATE POLICY "Attendees read their own verification"
    ON public.attendee_age_verifications FOR SELECT
    USING (attendee_id = auth.uid() OR verified_by = auth.uid());

DROP POLICY IF EXISTS "Rostered staff record verifications"
    ON public.attendee_age_verifications;
CREATE POLICY "Rostered staff record verifications"
    ON public.attendee_age_verifications FOR INSERT
    TO authenticated
    WITH CHECK (
        verified_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.event_service_roster r
            WHERE r.event_id = attendee_age_verifications.event_id
              AND r.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Attendees read their own band" ON public.issued_wristbands;
CREATE POLICY "Attendees read their own band"
    ON public.issued_wristbands FOR SELECT
    USING (attendee_id = auth.uid() OR issued_by = auth.uid());

DROP POLICY IF EXISTS "Servers read their own certifications" ON public.server_certifications;
CREATE POLICY "Servers read their own certifications"
    ON public.server_certifications FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service configuration is readable" ON public.event_service_compliance;
CREATE POLICY "Service configuration is readable"
    ON public.event_service_compliance FOR SELECT
    TO authenticated
    USING (TRUE);

-- The service log is evidence, so it is insert-only: no update or delete
-- policy exists. A refusal that can be edited away later is not a record.
DROP POLICY IF EXISTS "Service log is insert only" ON public.service_events;
CREATE POLICY "Service log is insert only"
    ON public.service_events FOR INSERT
    TO authenticated
    WITH CHECK (served_by = auth.uid());

REVOKE ALL ON public.attendee_age_verifications FROM anon;
REVOKE ALL ON public.issued_wristbands FROM anon;
REVOKE ALL ON public.service_events FROM anon;

COMMENT ON TABLE public.attendee_age_verifications IS
    'Outcome of an ID check. Deliberately stores the resulting band and not the date of birth (#3398).';
COMMENT ON TABLE public.issued_wristbands IS
    'Bands actually handed over, kept separate from verifications so the two can be reconciled.';
COMMENT ON FUNCTION public.reconcile_event_wristbands IS
    'Bands issued without a matching ID check, and checks with no band. The anomaly report an auditor asks for.';
COMMENT ON FUNCTION public.service_approval_stale IS
    'True when the event has changed materially since its service approval was granted.';
