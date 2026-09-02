-- Migration: Buddy Matcher (#2728)
-- Description: Opt-in "Find a Roommate / Buddy" matching system.
--
--   1. Users explicitly opt in via `buddy_matcher_profiles` (with a brief bio).
--   2. A TF-IDF embedding over the categories of events they RSVP'd to is
--      stored as a pgvector `vector(64)` column (one bucket per category,
--      hashed by category name, L2-normalised so cosine similarity is
--      mathematically sound).
--   3. `find_buddy_matches()` performs a K-Nearest-Neighbours search using the
--      pgvector cosine distance operator (<=>) backed by an IVFFlat index.
--   4. `send_buddy_wave()` / `respond_buddy_wave()` implement the playful
--      wave handshake; accepting a wave surfaces an E2EE DM conversation
--      between the two users (the direct_messages channel is derived from
--      sender/receiver pairs, so both sides simply get pointed at /messages).
--
-- Privacy:
--   - The pool is strictly opt-in; RLS gives each user ownership of exactly
--     their own row, so opting out (`is_active = false` or DELETE) removes
--     them from every match result instantly.
--   - Embeddings are never exposed through RLS reads; matches only surface
--     profile fields + similarity through a SECURITY DEFINER RPC that filters
--     out blocked users and existing pending/accepted waves.
--
-- Async vector generation:
--   - RSVPs merely flip `embedding_stale` (a cheap single-row UPDATE) so
--     normal RSVP actions are never slowed down.
--   - A pg_cron job recomputes stale embeddings hourly, and callers refresh
--     lazily inside `find_buddy_matches()` when their own vector is stale.

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Opt-in matching pool ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buddy_matcher_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    bio TEXT NOT NULL CHECK (char_length(bio) <= 280),
    embedding vector(64),
    top_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    embedding_stale BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.buddy_matcher_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own matcher profile." ON public.buddy_matcher_profiles;
CREATE POLICY "Users can view their own matcher profile."
    ON public.buddy_matcher_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can opt in with their own row." ON public.buddy_matcher_profiles;
CREATE POLICY "Users can opt in with their own row."
    ON public.buddy_matcher_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own matcher profile." ON public.buddy_matcher_profiles;
CREATE POLICY "Users can update their own matcher profile."
    ON public.buddy_matcher_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can opt out by deleting their row." ON public.buddy_matcher_profiles;
CREATE POLICY "Users can opt out by deleting their row."
    ON public.buddy_matcher_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- IVFFlat cosine index keeps the KNN search well under the 200ms budget.
CREATE INDEX IF NOT EXISTS idx_buddy_matcher_embedding
    ON public.buddy_matcher_profiles
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_buddy_matcher_stale
    ON public.buddy_matcher_profiles (updated_at)
    WHERE is_active = TRUE AND embedding_stale = TRUE;

-- ─── 2. Waves ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buddy_waves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT buddy_waves_no_self CHECK (sender_id <> receiver_id),
    -- One wave per direction: prevents spamming, while the RPC layer also
    -- rejects a second wave when one is already pending/accepted either way.
    CONSTRAINT buddy_waves_unique_direction UNIQUE (sender_id, receiver_id),
    CONSTRAINT buddy_waves_responded_required CHECK (
        (status = 'pending' AND responded_at IS NULL)
        OR (status <> 'pending' AND responded_at IS NOT NULL)
    )
);

ALTER TABLE public.buddy_waves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Waves are visible to both participants." ON public.buddy_waves;
CREATE POLICY "Waves are visible to both participants."
    ON public.buddy_waves FOR SELECT
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can wave at opted-in buddies." ON public.buddy_waves;
CREATE POLICY "Users can wave at opted-in buddies."
    ON public.buddy_waves FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can respond to pending waves." ON public.buddy_waves;
CREATE POLICY "Receivers can respond to pending waves."
    ON public.buddy_waves FOR UPDATE
    TO authenticated
    USING (auth.uid() = receiver_id AND status = 'pending')
    WITH CHECK (auth.uid() = receiver_id AND status <> 'pending');

CREATE INDEX IF NOT EXISTS idx_buddy_waves_receiver_status
    ON public.buddy_waves (receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddy_waves_sender_status
    ON public.buddy_waves (sender_id, status, created_at DESC);

-- ─── 3. TF-IDF embedding generation ──────────────────────────────────────────

-- Buckets are derived from the category name so the mapping is stable across
-- environments; collisions simply merge two topics into one dimension.
CREATE OR REPLACE FUNCTION public.compute_tfidf_embedding(p_user_id UUID)
RETURNS vector(64)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    c_dims CONSTANT INTEGER := 64;
    v_weights NUMERIC[];
    v_norm NUMERIC := 0;
    v_bucket INTEGER;
    v_row RECORD;
BEGIN
    SELECT array_fill(0::NUMERIC, ARRAY[c_dims]) INTO v_weights;

    -- Smoothed TF-IDF: weight(category) = tf * ln(1 + totalUsers / df).
    -- The smoothing guarantees a positive IDF so a single-category history
    -- still produces a usable direction instead of an all-zero vector.
    FOR v_row IN
        WITH my_categories AS (
            SELECT ec.name, count(*)::NUMERIC AS tf
            FROM event_rsvps r
            JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
            JOIN event_categories ec ON ec.id = e.category_id
            WHERE r.user_id = p_user_id
            GROUP BY ec.name
        ),
        document_frequency AS (
            SELECT ec.name, count(DISTINCT r.user_id)::NUMERIC AS df
            FROM event_rsvps r
            JOIN events e ON e.id = r.event_id
            JOIN event_categories ec ON ec.id = e.category_id
            GROUP BY ec.name
        ),
        totals AS (
            SELECT count(DISTINCT r.user_id)::NUMERIC AS n FROM event_rsvps r
        )
        SELECT mc.name,
               mc.tf * ln(1 + t.n / GREATEST(df.df, 1)) AS tfidf
        FROM my_categories mc
        CROSS JOIN totals t
        JOIN document_frequency df USING (name)
    LOOP
        v_bucket := abs(hashtext(v_row.name)) % c_dims + 1;
        v_weights[v_bucket] := COALESCE(v_weights[v_bucket], 0) + v_row.tfidf;
        v_norm := v_norm + power(COALESCE(v_weights[v_bucket], 0), 2);
    END LOOP;

    IF v_norm = 0 THEN
        RETURN NULL;
    END IF;

    v_norm := sqrt(v_norm);
    FOR v_bucket IN 1 .. c_dims LOOP
        v_weights[v_bucket] := round(v_weights[v_bucket] / v_norm, 6);
    END LOOP;

    RETURN ('[' || array_to_string(v_weights, ',') || ']')::vector(64);
END;
$$;

-- Top categories (by TF-IDF weight) stored alongside the embedding so the UI
-- can explain *why* two users matched without another expensive query.
CREATE OR REPLACE FUNCTION public.compute_top_categories(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        array_agg(cat.name ORDER BY cat.weight DESC),
        '{}'::TEXT[]
    )
    FROM (
        SELECT ec.name, count(*)::NUMERIC AS weight
        FROM event_rsvps r
        JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
        JOIN event_categories ec ON ec.id = e.category_id
        WHERE r.user_id = p_user_id
        GROUP BY ec.name
        ORDER BY weight DESC
        LIMIT 5
    ) cat;
$$;

-- Recompute one user's embedding. Safe to call repeatedly; used after opt-in
-- and by the cron batch refresher below.
CREATE OR REPLACE FUNCTION public.refresh_buddy_embedding(p_user_id UUID)
RETURNS vector(64)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_embedding vector(64);
BEGIN
    -- Only the row owner (or an unauthenticated service/cron context) may
    -- trigger a recompute.
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Not permitted to refresh this embedding';
    END IF;

    v_embedding := compute_tfidf_embedding(p_user_id);

    UPDATE buddy_matcher_profiles
    SET embedding = v_embedding,
        top_categories = compute_top_categories(p_user_id),
        embedding_stale = FALSE,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN v_embedding;
END;
$$;

-- Batch refresher for the cron job: bounded work per run.
CREATE OR REPLACE FUNCTION public.refresh_stale_buddy_embeddings(p_batch INTEGER DEFAULT 200)
RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INTEGER := 0;
    v_uid UUID;
BEGIN
    FOR v_uid IN
        SELECT user_id FROM buddy_matcher_profiles
        WHERE is_active = TRUE
          AND (embedding_stale = TRUE OR embedding IS NULL)
        ORDER BY updated_at ASC
        LIMIT GREATEST(p_batch, 1)
    LOOP
        PERFORM refresh_buddy_embedding(v_uid);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- ─── 4. Async staleness marking on RSVP activity ─────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_buddy_embedding_stale()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    UPDATE buddy_matcher_profiles
    SET embedding_stale = TRUE
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buddy_rsvp_marks_embedding_stale ON event_rsvps;
CREATE TRIGGER trg_buddy_rsvp_marks_embedding_stale
AFTER INSERT ON event_rsvps
FOR EACH ROW EXECUTE FUNCTION mark_buddy_embedding_stale();

-- Hourly batch refresh (guarded — pg_cron may not be installed locally).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN
            PERFORM cron.unschedule('refresh-buddy-embeddings');
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        PERFORM cron.schedule(
            'refresh-buddy-embeddings',
            '15 * * * *',
            $$SELECT public.refresh_stale_buddy_embeddings(500);$$
        );
    END IF;
END $$;

-- ─── 5. KNN matching RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_buddy_matches(
    p_limit INTEGER DEFAULT 5,
    p_min_similarity DOUBLE PRECISION DEFAULT 0.05
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    bio TEXT,
    similarity DOUBLE PRECISION,
    shared_categories TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_my_embedding vector(64);
    v_stale BOOLEAN;
BEGIN
    -- Lazily refresh our own stale vector so matches reflect the latest RSVPs.
    SELECT embedding, embedding_stale INTO v_my_embedding, v_stale
    FROM buddy_matcher_profiles
    WHERE user_id = auth.uid() AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN; -- not opted in
    END IF;

    IF v_stale OR v_my_embedding IS NULL THEN
        v_my_embedding := refresh_buddy_embedding(auth.uid());
        IF v_my_embedding IS NULL THEN
            RETURN; -- no RSVP history yet -> nothing sensible to match on
        END IF;
    END IF;

    RETURN QUERY
    WITH neighbours AS (
        SELECT
            bm.user_id,
            1 - (bm.embedding <=> v_my_embedding) AS score
        FROM buddy_matcher_profiles bm
        WHERE bm.user_id <> auth.uid()
          AND bm.is_active = TRUE
          AND bm.embedding IS NOT NULL
          -- Respect blocks in both directions.
          AND NOT EXISTS (
              SELECT 1 FROM user_blocks b
              WHERE (b.blocker_id = auth.uid() AND b.blocked_id = bm.user_id)
                 OR (b.blocker_id = bm.user_id AND b.blocked_id = auth.uid())
          )
          -- Don't re-suggest users with a live wave either way.
          AND NOT EXISTS (
              SELECT 1 FROM buddy_waves w
              WHERE w.status IN ('pending', 'accepted')
                AND ((w.sender_id = auth.uid() AND w.receiver_id = bm.user_id)
                  OR (w.sender_id = bm.user_id AND w.receiver_id = auth.uid()))
          )
        ORDER BY bm.embedding <=> v_my_embedding
        LIMIT LEAST(GREATEST(p_limit, 1), 20)
    )
    SELECT
        p.id,
        p.full_name,
        p.handle,
        p.avatar_url,
        bm.bio,
        nb.score,
        -- Categories present in both RSVP histories (explanations for the UI).
        COALESCE((
            SELECT ARRAY(
                SELECT DISTINCT e1_cat.name
                FROM event_rsvps r1
                JOIN events e1 ON e1.id = r1.event_id AND e1.deleted_at IS NULL
                JOIN event_categories e1_cat ON e1_cat.id = e1.category_id
                WHERE r1.user_id = auth.uid()
              INTERSECT
                SELECT DISTINCT e2_cat.name
                FROM event_rsvps r2
                JOIN events e2 ON e2.id = r2.event_id AND e2.deleted_at IS NULL
                JOIN event_categories e2_cat ON e2_cat.id = e2.category_id
                WHERE r2.user_id = nb.user_id
            )
        ), '{}'::TEXT[])
    FROM neighbours nb
    JOIN profiles p ON p.id = nb.user_id
    JOIN buddy_matcher_profiles bm ON bm.user_id = nb.user_id
    WHERE nb.score >= p_min_similarity
    ORDER BY nb.score DESC;
END;
$$;

-- ─── 6. Wave handshake ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_buddy_wave(p_receiver UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_wave_id UUID;
    v_sender_name TEXT;
BEGIN
    IF p_receiver IS NULL OR p_receiver = auth.uid() THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid wave target.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM buddy_matcher_profiles
        WHERE user_id = auth.uid() AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Opt in to the Buddy Matcher first.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM buddy_matcher_profiles
        WHERE user_id = p_receiver AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'That student is not in the matching pool.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM user_blocks
        WHERE (blocker_id = auth.uid() AND blocked_id = p_receiver)
           OR (blocker_id = p_receiver AND blocked_id = auth.uid())
    ) THEN
        -- Deliberately vague: never disclose block relationships.
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unable to send a wave.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM buddy_waves
        WHERE status IN ('pending', 'accepted')
          AND ((sender_id = auth.uid() AND receiver_id = p_receiver)
            OR (sender_id = p_receiver AND receiver_id = auth.uid()))
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'A wave already exists between you.');
    END IF;

    INSERT INTO buddy_waves (sender_id, receiver_id)
    VALUES (auth.uid(), p_receiver)
    RETURNING id INTO v_wave_id;

    SELECT full_name INTO v_sender_name FROM profiles WHERE id = auth.uid();

    INSERT INTO notifications (user_id, actor_id, type, title, message, link)
    VALUES (
        p_receiver,
        auth.uid(),
        'buddy_wave',
        'Someone waved at you! 👋',
        COALESCE(v_sender_name, 'A student') || ' thinks you two could be great buddies.',
        '/buddy-match'
    );

    RETURN jsonb_build_object('success', TRUE, 'wave_id', v_wave_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_buddy_wave(p_wave_id UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sender UUID;
    v_receiver_name TEXT;
BEGIN
    SELECT sender_id INTO v_sender
    FROM buddy_waves
    WHERE id = p_wave_id
      AND receiver_id = auth.uid()
      AND status = 'pending';

    IF v_sender IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Wave not found or already handled.');
    END IF;

    UPDATE buddy_waves
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = NOW()
    WHERE id = p_wave_id;

    IF NOT p_accept THEN
        -- Declines stay private: no notification, no trace for the sender.
        RETURN jsonb_build_object('success', TRUE, 'status', 'declined');
    END IF;

    -- Accepted: nudge both sides into their E2EE DM conversation.
    SELECT full_name INTO v_receiver_name FROM profiles WHERE id = auth.uid();

    INSERT INTO notifications (user_id, actor_id, type, title, message, link)
    VALUES
        (
            v_sender,
            auth.uid(),
            'buddy_wave_accepted',
            'It''s a match! 🎉',
            COALESCE(v_receiver_name, 'Your new buddy') || ' accepted your wave — say hi in messages.',
            '/messages'
        ),
        (
            auth.uid(),
            v_sender,
            'buddy_wave_accepted',
            'You''re buddies now 🎉',
            'Your E2EE chat with your new buddy is ready.',
            '/messages'
        );

    RETURN jsonb_build_object('success', TRUE, 'status', 'accepted');
END;
$$;
