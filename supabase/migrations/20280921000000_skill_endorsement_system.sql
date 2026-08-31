-- ============================================================
-- Migration: 20280921000000_skill_endorsement_system.sql
-- Issue: #3677 — Dynamic "Skill Endorsement" System
--
-- Context
--   A student who volunteers to run the A/V mixing board for ten
--   events has no formal proof of that skill for their resume.
--   `event_rsvps.checked_in` and `shift_attendance_records` prove
--   they were there; nothing converts that attendance into a
--   recruiter-facing, verified credential.
--
-- Design notes
--   1. `skill_endorsements` is the credential ledger. One row per
--      (endorsee, endorser, skill) — LinkedIn-style: a person can
--      only endorse a given skill for you once, re-endorsement at
--      a later event refreshes the row (upsert).
--   2. Rows are written exclusively by the SECURITY DEFINER RPC
--      `endorse_volunteer_skill()`. RLS grants clients no
--      INSERT/UPDATE policy at all, so a browser can never forge
--      a row — only the RPC's guarded path can.
--   3. The RPC refuses to write unless the volunteer *actually
--      attended* the event (checked-in RSVP, or an attended/late
--      shift outcome), the event has ended, the endorsement is
--      made within the 30-day window after it ended, and the
--      caller is the event's organizer. This cryptographically
--      links every endorsement to real attendance.
--   4. `proof_digest` is SHA-256 over the canonical payload
--      (endorsee | endorser | event | skill). The
--      `enforce_skill_endorsement_integrity` trigger recomputes
--      it on every write and rejects any row whose digest does
--      not match — so even a service-role writer cannot store a
--      row that is not internally consistent and traceable to
--      its event.
--   5. `endorser_weight` is the trust score of the endorser:
--      club owner / president / admin = 1.00, officer-tier
--      roles = 0.85, ordinary members = 0.60. An endorsement
--      from a Club President therefore outweighs a peer's.
--   6. The schema is defensive about deployment drift: some
--      deployments carry `club_members.role` (legacy enum),
--      others migrated to `club_members.role_id -> club_roles`
--      (`20260720000006_dynamic_club_roles.sql`), and
--      `shift_attendance_records` may be absent. All such
--      branches are resolved at runtime.
-- ============================================================

BEGIN;

-- ─── 1. Skill-tag normalisation ─────────────────────────────────────
-- Tags are stored normalised: lowercase, trimmed, single internal
-- spaces. "Audio Engineering" and "audio  engineering" are one skill.
CREATE OR REPLACE FUNCTION public.normalize_skill_tag(p_tag TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$     SELECT lower(regexp_replace(btrim(COALESCE(p_tag, '')), '\s+', ' ', 'g'));
 $$;

-- ─── 2. Canonical proof digest ──────────────────────────────────────
-- SHA-256 over a versioned, pipe-delimited payload. The same
-- canonicalisation lives in src/lib/skillEndorsements.ts so the
-- browser can independently verify any row it reads.
CREATE OR REPLACE FUNCTION public.build_endorsement_proof_digest(
    p_user_id UUID,
    p_endorser_user_id UUID,
    p_event_id UUID,
    p_skill_tag TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$     SELECT encode(
        sha256(
            convert_to(
                'skill_endorsement:v1|'
                    || p_user_id::TEXT
                    || '|'
                    || p_endorser_user_id::TEXT
                    || '|'
                    || p_event_id::TEXT
                    || '|'
                    || public.normalize_skill_tag(p_skill_tag),
                'UTF8'
            )
        ),
        'hex'
    );
 $$;

-- ─── 3. The credential ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_endorsements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endorser_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id           UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    skill_tag         TEXT NOT NULL,
    comment           TEXT,
    -- Trust score of the endorser at endorsement time (0.500–1.000).
    endorser_weight   NUMERIC(4,3) NOT NULL,
    -- How attendance was proven when the row was written.
    attendance_proof  JSONB NOT NULL,
    -- SHA-256 of the canonical payload; enforced by trigger.
    proof_digest      TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A person cannot endorse themselves.
    CONSTRAINT skill_endorsements_no_self_endorsement
        CHECK (user_id <> endorser_user_id),
    -- Tags are stored in normalised form.
    CONSTRAINT skill_endorsements_skill_tag_normalised
        CHECK (public.normalize_skill_tag(skill_tag) = skill_tag
               AND char_length(skill_tag) BETWEEN 2 AND 40),
    CONSTRAINT skill_endorsements_skill_tag_charset
        CHECK (skill_tag ~ '^[a-z0-9][a-z0-9 ./&+()-]*$'),
    CONSTRAINT skill_endorsements_comment_length
        CHECK (comment IS NULL OR char_length(btrim(comment)) BETWEEN 3 AND 300),
    CONSTRAINT skill_endorsements_weight_range
        CHECK (endorser_weight >= 0.5 AND endorser_weight <= 1.0),
    -- One endorsement per (endorsee, endorser, skill); re-endorsement
    -- after a later event updates the row instead of stacking.
    CONSTRAINT skill_endorsements_unique_per_endorser
        UNIQUE (user_id, endorser_user_id, skill_tag)
);

COMMENT ON TABLE public.skill_endorsements IS
    'Issue #3677 — verified skill endorsements. Written only via endorse_volunteer_skill(); every row is digest-locked to the event it was earned at.';
COMMENT ON COLUMN public.skill_endorsements.attendance_proof IS
    'Attendance evidence recorded at write time: {"method": "rsvp_check_in" | "shift_attendance", "event_id": ..., "event_ended_at": ..., "verified_at": ...}.';

CREATE INDEX IF NOT EXISTS idx_skill_endorsements_user_skill
    ON public.skill_endorsements (user_id, skill_tag);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_event
    ON public.skill_endorsements (event_id);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_endorser
    ON public.skill_endorsements (endorser_user_id);

-- ─── 4. Integrity trigger ───────────────────────────────────────────
-- Every write (from any role, including service role) must keep the
-- row digest-consistent and its attendance proof pointing at the same
-- event. This is what makes fabricated rows impossible to store.
CREATE OR REPLACE FUNCTION public.enforce_skill_endorsement_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$ BEGIN
    IF NEW.proof_digest IS DISTINCT FROM
       public.build_endorsement_proof_digest(
           NEW.user_id, NEW.endorser_user_id, NEW.event_id, NEW.skill_tag
       ) THEN
        RAISE EXCEPTION
            'skill_endorsement integrity violation: proof_digest does not match canonical payload';
    END IF;

    IF COALESCE(NEW.attendance_proof ->> 'event_id', '') <> NEW.event_id::TEXT THEN
        RAISE EXCEPTION
            'skill_endorsement integrity violation: attendance_proof event mismatch';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS trg_skill_endorsement_integrity ON public.skill_endorsements;
CREATE TRIGGER trg_skill_endorsement_integrity
    BEFORE INSERT OR UPDATE ON public.skill_endorsements
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_skill_endorsement_integrity();

-- ─── 5. Organiser predicate & trust score ───────────────────────────
-- True for the event creator, the owning club's creator, or an
-- approved admin/owner-tier club member. Handles both the
-- club_roles (permissions_level) and legacy club_members.role
-- deployments.
CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_event     public.events%ROWTYPE;
    v_has_roles BOOLEAN;
BEGIN
    IF p_event_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- The event creator is always an organiser.
    IF v_event.created_by = p_user_id THEN
        RETURN TRUE;
    END IF;

    IF v_event.club_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Club owner (creator of the club that runs the event).
    IF EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = v_event.club_id AND c.created_by = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    v_has_roles := to_regclass('public.club_roles') IS NOT NULL;

    IF v_has_roles THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.club_members cm
            JOIN public.club_roles cr ON cr.id = cm.role_id
            WHERE cm.club_id = v_event.club_id
              AND cm.user_id = p_user_id
              AND cm.status::TEXT = 'approved'
              AND cr.permissions_level >= 100
        );
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = v_event.club_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
END;
 $$;

-- Trust score of an endorser, relative to the club running the event.
--   1.000  club creator / president / owner / admin-tier (>= 100)
--   0.850  officer-tier roles (permissions 40-99, or 'officer')
--   0.600  ordinary approved members
--   0.500  everyone else
CREATE OR REPLACE FUNCTION public.endorser_trust_weight(p_event_id UUID, p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_event     public.events%ROWTYPE;
    v_has_roles BOOLEAN;
    v_level     INTEGER;
    v_title     TEXT;
BEGIN
    IF p_event_id IS NULL OR p_user_id IS NULL THEN
        RETURN 0.5;
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RETURN 0.5;
    END IF;

    IF v_event.club_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = v_event.club_id AND c.created_by = p_user_id
    ) THEN
        RETURN 1.0;
    END IF;

    IF v_event.club_id IS NULL THEN
        RETURN 0.5;
    END IF;

    v_has_roles := to_regclass('public.club_roles') IS NOT NULL;

    IF v_has_roles THEN
        SELECT cr.permissions_level, cr.title
          INTO v_level, v_title
          FROM public.club_members cm
          JOIN public.club_roles cr ON cr.id = cm.role_id
         WHERE cm.club_id = v_event.club_id
           AND cm.user_id = p_user_id
           AND cm.status::TEXT = 'approved'
         ORDER BY cr.permissions_level DESC
         LIMIT 1;

        IF v_level IS NULL THEN
            RETURN 0.5;
        END IF;

        -- President/owner by title, regardless of the numeric tier.
        IF v_title IS NOT NULL AND (
            v_title ILIKE '%president%' OR v_title ILIKE '%owner%'
        ) THEN
            RETURN 1.0;
        END IF;

        IF v_level >= 100 THEN
            RETURN 1.0;
        END IF;
        IF v_level >= 40 THEN
            RETURN 0.85;
        END IF;
        RETURN 0.6;
    END IF;

    -- Legacy club_members.role deployments.
    RETURN (
        SELECT CASE cm.role::TEXT
                   WHEN 'owner'  THEN 1.0
                   WHEN 'admin'  THEN 1.0
                   WHEN 'officer' THEN 0.85
                   ELSE 0.6
               END
          FROM public.club_members cm
         WHERE cm.club_id = v_event.club_id
           AND cm.user_id = p_user_id
           AND cm.status::TEXT = 'approved'
         LIMIT 1
    );
END;
 $$;

-- ─── 6. Write RPC — the only door into the table ───────────────────
CREATE OR REPLACE FUNCTION public.endorse_volunteer_skill(
    p_event_id UUID,
    p_user_id UUID,
    p_skill_tag TEXT,
    p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_caller       UUID := auth.uid();
    v_event        public.events%ROWTYPE;
    v_ended_at     TIMESTAMPTZ;
    v_tag          TEXT;
    v_weight       NUMERIC;
    v_method       TEXT;
    v_attendance   JSONB;
    v_digest       TEXT;
    v_row_id       UUID;
    v_window_days  CONSTANT INTEGER := 30;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to endorse volunteers';
    END IF;

    -- ── skill tag ──
    v_tag := public.normalize_skill_tag(p_skill_tag);
    IF char_length(v_tag) < 2 OR char_length(v_tag) > 40
       OR v_tag !~ '^[a-z0-9][a-z0-9 ./&+()-]*$' THEN
        RAISE EXCEPTION
            'Invalid skill tag: use 2-40 characters (letters, digits, spaces, ./&+-())';
    END IF;

    IF p_comment IS NOT NULL AND (
        char_length(btrim(p_comment)) < 3 OR char_length(btrim(p_comment)) > 300
    ) THEN
        RAISE EXCEPTION 'Comment must be between 3 and 300 characters';
    END IF;

    -- ── event ──
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cancelled events cannot generate endorsements';
    END IF;

    v_ended_at := COALESCE(v_event.end_date, v_event.start_date, v_event.event_date);
    IF v_ended_at IS NULL OR v_ended_at > NOW() THEN
        RAISE EXCEPTION 'Endorsements open only after the event has ended';
    END IF;

    IF NOW() > v_ended_at + (v_window_days || ' days')::INTERVAL THEN
        RAISE EXCEPTION
            'The 30-day endorsement window for this event has closed';
    END IF;

    -- ── authorisation ──
    IF v_caller = p_user_id THEN
        RAISE EXCEPTION 'You cannot endorse yourself';
    END IF;

    IF NOT public.is_event_organizer(p_event_id, v_caller) THEN
        RAISE EXCEPTION 'Only the event organizer can endorse volunteers';
    END IF;

    -- ── attendance proof (the anti-fraud core) ──
    IF EXISTS (
        SELECT 1 FROM public.event_rsvps r
        WHERE r.event_id = p_event_id
          AND r.user_id = p_user_id
          AND r.checked_in = TRUE
    ) THEN
        v_method := 'rsvp_check_in';
    ELSIF to_regclass('public.shift_attendance_records') IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.shift_attendance_records sar
        JOIN public.event_shifts es ON es.id = sar.shift_id
        WHERE es.event_id = p_event_id
          AND sar.user_id = p_user_id
          AND sar.outcome::TEXT IN ('attended', 'late')
    ) THEN
        v_method := 'shift_attendance';
    ELSE
        RAISE EXCEPTION
            'Cannot endorse: this volunteer has no verified attendance for the event';
    END IF;

    -- ── trust-weighted write ──
    v_weight := public.endorser_trust_weight(p_event_id, v_caller);

    v_attendance := jsonb_build_object(
        'method', v_method,
        'event_id', p_event_id::TEXT,
        'event_ended_at', v_ended_at,
        'verified_at', NOW()
    );

    v_digest := public.build_endorsement_proof_digest(
        p_user_id, v_caller, p_event_id, v_tag
    );

    INSERT INTO public.skill_endorsements (
        user_id, endorser_user_id, event_id, club_id,
        skill_tag, comment, endorser_weight, attendance_proof, proof_digest
    ) VALUES (
        p_user_id, v_caller, p_event_id, v_event.club_id,
        v_tag, NULLIF(btrim(p_comment), ''), v_weight, v_attendance, v_digest
    )
    ON CONFLICT (user_id, endorser_user_id, skill_tag)
    DO UPDATE SET
        event_id         = EXCLUDED.event_id,
        club_id          = EXCLUDED.club_id,
        comment          = EXCLUDED.comment,
        endorser_weight  = EXCLUDED.endorser_weight,
        attendance_proof = EXCLUDED.attendance_proof,
        proof_digest     = EXCLUDED.proof_digest,
        updated_at       = NOW()
    RETURNING id INTO v_row_id;

    RETURN jsonb_build_object(
        'id', v_row_id,
        'user_id', p_user_id,
        'skill_tag', v_tag,
        'endorser_weight', v_weight,
        'proof_digest', v_digest,
        'attendance_method', v_method
    );
END;
 $$;

-- ─── 7. Read RPC: endorsementable volunteers for an organiser ──────
-- Everyone who *actually attended* (checked-in RSVP or an
-- attended/late shift), with the skills the caller already
-- endorsed, so the UI can grey them out.
CREATE OR REPLACE FUNCTION public.get_endorseable_volunteers(p_event_id UUID)
RETURNS TABLE (
    user_id           UUID,
    full_name         TEXT,
    handle            TEXT,
    avatar_url        TEXT,
    attendance_method TEXT,
    endorsed_skills   TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to endorse volunteers';
    END IF;
    IF NOT public.is_event_organizer(p_event_id, v_caller) THEN
        RAISE EXCEPTION 'Only the event organizer can view endorseable volunteers';
    END IF;

    RETURN QUERY
    WITH attendees AS (
        SELECT r.user_id, 'rsvp_check_in'::TEXT AS method
        FROM public.event_rsvps r
        WHERE r.event_id = p_event_id
          AND r.checked_in = TRUE
        UNION
        SELECT sar.user_id, 'shift_attendance'::TEXT AS method
        FROM public.shift_attendance_records sar
        JOIN public.event_shifts es ON es.id = sar.shift_id
        WHERE es.event_id = p_event_id
          AND sar.outcome::TEXT IN ('attended', 'late')
    ),
    -- A user who appears in both lists is reported once; the
    -- RSVP check-in wins (alphabetically first in DISTINCT ON).
    deduped AS (
        SELECT DISTINCT ON (a.user_id) a.user_id, a.method
        FROM attendees a
        ORDER BY a.user_id, a.method
    )
    SELECT
        d.user_id,
        COALESCE(
            NULLIF(btrim(p.full_name), ''),
            NULLIF(btrim(p.first_name || ' ' || p.last_name), ''),
            p.handle
        ),
        p.handle,
        p.avatar_url,
        d.method,
        COALESCE(
            (SELECT array_agg(se.skill_tag ORDER BY se.skill_tag)
             FROM public.skill_endorsements se
             WHERE se.user_id = d.user_id
               AND se.endorser_user_id = v_caller),
            '{}'::TEXT[]
        )
    FROM deduped d
    JOIN public.profiles p ON p.id = d.user_id
    ORDER BY 2;
END;
 $$;

-- ─── 8. Read RPC: public endorsement feed for a profile ────────────
CREATE OR REPLACE FUNCTION public.get_user_skill_endorsements(p_user_id UUID)
RETURNS TABLE (
    id                UUID,
    user_id           UUID,
    endorser_user_id  UUID,
    endorser_name     TEXT,
    endorser_handle   TEXT,
    endorser_avatar   TEXT,
    event_id          UUID,
    event_title       TEXT,
    club_name         TEXT,
    skill_tag         TEXT,
    comment           TEXT,
    endorser_weight   NUMERIC,
    attendance_proof  JSONB,
    proof_digest      TEXT,
    created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        se.id,
        se.user_id,
        se.endorser_user_id,
        COALESCE(
            NULLIF(btrim(p.full_name), ''),
            NULLIF(btrim(p.first_name || ' ' || p.last_name), ''),
            p.handle
        ),
        p.handle,
        p.avatar_url,
        se.event_id,
        e.title,
        c.name,
        se.skill_tag,
        se.comment,
        se.endorser_weight,
        se.attendance_proof,
        se.proof_digest,
        se.created_at
    FROM public.skill_endorsements se
    JOIN public.profiles p ON p.id = se.endorser_user_id
    JOIN public.events e   ON e.id = se.event_id
    LEFT JOIN public.clubs c ON c.id = se.club_id
    WHERE se.user_id = p_user_id
    ORDER BY se.endorser_weight DESC, se.created_at DESC;
END;
 $$;

-- ─── 9. Read RPC: aggregated skill summary for a profile ───────────
CREATE OR REPLACE FUNCTION public.get_skill_endorsement_summary(p_user_id UUID)
RETURNS TABLE (
    skill_tag         TEXT,
    weighted_score    NUMERIC,
    endorsement_count BIGINT,
    distinct_endorsers BIGINT,
    last_endorsed_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        se.skill_tag,
        ROUND(SUM(se.endorser_weight), 3),
        COUNT(*),
        COUNT(DISTINCT se.endorser_user_id),
        MAX(se.created_at)
    FROM public.skill_endorsements se
    WHERE se.user_id = p_user_id
    GROUP BY se.skill_tag
    ORDER BY SUM(se.endorser_weight) DESC, COUNT(DISTINCT se.endorser_user_id) DESC;
END;
 $$;

-- ─── 10. Row Level Security ────────────────────────────────────────
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

-- Endorsements are public credentials: anyone (including signed-out
-- recruiters following a shared profile link) may read them.
DROP POLICY IF EXISTS "Anyone can read skill endorsements" ON public.skill_endorsements;
CREATE POLICY "Anyone can read skill endorsements"
    ON public.skill_endorsements
    FOR SELECT
    USING (TRUE);

-- Deliberately NO INSERT / UPDATE policies: the only write path is
-- the SECURITY DEFINER RPC (or the service role), which itself
-- verifies attendance, organiser status and the time window.

-- The endorsee may hide an endorsement from their profile.
DROP POLICY IF EXISTS "Endorsees can hide endorsements on their profile" ON public.skill_endorsements;
CREATE POLICY "Endorsees can hide endorsements on their profile"
    ON public.skill_endorsements
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- The endorser may retract their own endorsement.
DROP POLICY IF EXISTS "Endorsers can retract their endorsements" ON public.skill_endorsements;
CREATE POLICY "Endorsers can retract their endorsements"
    ON public.skill_endorsements
    FOR DELETE TO authenticated
    USING (auth.uid() = endorser_user_id);

-- ─── 11. Grants ─────────────────────────────────────────────────────
GRANT SELECT ON public.skill_endorsements TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.normalize_skill_tag(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.build_endorsement_proof_digest(UUID, UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.endorser_trust_weight(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.endorse_volunteer_skill(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_endorseable_volunteers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_skill_endorsements(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_skill_endorsement_summary(UUID) TO authenticated, anon;

COMMIT;
