-- ============================================================
-- Migration: 20260824000000_create_election_module.sql
-- Description:
--   Secure club executive election / polling module. Enforces exactly
--   one vote per verified (approved) club member, keeps individual
--   ballots unreadable by anyone (including admins), and keeps
--   aggregate results hidden until the election's end_time has passed.
--   Handles exact ties by auto-extending the election 24h via pg_cron.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Types & tables
-- ------------------------------------------------------------

CREATE TYPE election_status AS ENUM ('draft', 'open', 'closed');

CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  end_time TIMESTAMPTZ NOT NULL,
  status election_status NOT NULL DEFAULT 'draft',
  -- How many times this election was auto-extended for an exact tie.
  -- Kept for transparency/audit trail, not used for any access control.
  tie_extension_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A plain CHECK constraint re-validates on every UPDATE, not just INSERT —
-- which would wrongly block the system from ever closing an election once
-- its end_time has legitimately passed. This needs to only ever fire at
-- creation time, so it's a trigger instead of a CHECK.
CREATE OR REPLACE FUNCTION public.check_election_end_time_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_time <= NOW() THEN
    RAISE EXCEPTION 'end_time must be in the future when an election is created.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_election_end_time_on_create
  BEFORE INSERT ON elections
  FOR EACH ROW
  EXECUTE FUNCTION public.check_election_end_time_on_create();

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  -- The candidate's own account, if they have one. Nullable so an admin can
  -- add a write-in-style candidate who isn't (yet) registered.
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  bio TEXT,
  -- Path within the private `election-manifestos` storage bucket, e.g.
  -- "{election_id}/{candidate_id}/manifesto.pdf". Never a public URL —
  -- the client must request a signed URL through Supabase Storage.
  manifesto_path TEXT,
  manifesto_type TEXT CHECK (manifesto_type IS NULL OR manifesto_type IN ('video', 'pdf')),
  ballot_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lets `votes.candidate_id` carry a composite FK back to
  -- (id, election_id), so the database itself guarantees a vote's
  -- candidate actually belongs to the election it's cast in — this is
  -- enforced by Postgres, not just by RLS or application code.
  UNIQUE (id, election_id)
);

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  -- Only ever used by RLS/the UNIQUE constraint to enforce "one vote per
  -- member" — never surfaced in any admin-facing query or view. See the
  -- `election_results` view below for the only sanctioned way to read
  -- aggregate outcomes.
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (candidate_id, election_id) REFERENCES candidates(id, election_id) ON DELETE CASCADE,
  UNIQUE (election_id, user_id)
);

CREATE INDEX idx_elections_club_id ON elections(club_id);
CREATE INDEX idx_elections_status_end_time ON elections(status, end_time);
CREATE INDEX idx_candidates_election_id ON candidates(election_id);
CREATE INDEX idx_votes_election_id ON votes(election_id);
CREATE INDEX idx_votes_candidate_id ON votes(candidate_id);

-- ------------------------------------------------------------
-- 2. Helper: is the caller an approved member of this election's club?
--    (Mirrors the "approved" gate already used throughout the app —
--    an allow-list, not a deny-list, so a future membership state like
--    "alumni" is automatically excluded without touching this function.)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_approved_club_member(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = p_club_id
      AND user_id = p_user_id
      AND status = 'approved'::join_status
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_club_member(UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. RLS: elections
-- ------------------------------------------------------------

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their club's elections."
  ON elections FOR SELECT
  USING (public.is_approved_club_member(club_id, auth.uid()));

CREATE POLICY "Club admins can create elections."
  ON elections FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_club_admin(club_id, auth.uid())
      OR EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND created_by = auth.uid())
    )
  );

-- Deliberately restrictive: admins may only edit an election while it is
-- still a draft. Once opened, `end_time` and `status` become untouchable
-- by any human — including the club president — and can only change via
-- the SECURITY DEFINER close_finished_elections() job below. This is what
-- actually prevents an admin from shortening/extending the deadline to
-- sway the outcome once voting has started.
CREATE POLICY "Club admins can edit draft elections."
  ON elections FOR UPDATE
  USING (
    status = 'draft'
    AND (
      public.is_club_admin(club_id, auth.uid())
      OR EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.is_club_admin(club_id, auth.uid())
    OR EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND created_by = auth.uid())
  );

CREATE POLICY "Club admins can delete draft elections."
  ON elections FOR DELETE
  USING (
    status = 'draft'
    AND (
      public.is_club_admin(club_id, auth.uid())
      OR EXISTS (SELECT 1 FROM clubs WHERE id = club_id AND created_by = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- 4. RLS: candidates
-- ------------------------------------------------------------

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view candidates in their club's elections."
  ON candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = candidates.election_id
        AND public.is_approved_club_member(e.club_id, auth.uid())
    )
  );

-- Candidates can only be added/edited/removed while the election is still
-- a draft — the ballot is frozen the moment voting opens, so no one can
-- add a surprise candidate or edit a rival's bio mid-election.
CREATE POLICY "Club admins can manage candidates in draft elections."
  ON candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = candidates.election_id
        AND e.status = 'draft'
        AND (
          public.is_club_admin(e.club_id, auth.uid())
          OR EXISTS (SELECT 1 FROM clubs WHERE id = e.club_id AND created_by = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = candidates.election_id
        AND e.status = 'draft'
        AND (
          public.is_club_admin(e.club_id, auth.uid())
          OR EXISTS (SELECT 1 FROM clubs WHERE id = e.club_id AND created_by = auth.uid())
        )
    )
  );

-- ------------------------------------------------------------
-- 5. RPC: candidates set their own manifesto (video/PDF pointer)
--    A narrow SECURITY DEFINER function instead of a blanket RLS UPDATE
--    policy for candidates, so a candidate can only ever touch their own
--    manifesto_path/manifesto_type — never their name, bio, or ballot
--    position — and only while the election is still a draft.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_candidate_manifesto(
  p_candidate_id UUID,
  p_manifesto_path TEXT,
  p_manifesto_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_manifesto_type NOT IN ('video', 'pdf') THEN
    RAISE EXCEPTION 'manifesto_type must be video or pdf';
  END IF;

  UPDATE candidates c
  SET manifesto_path = p_manifesto_path,
      manifesto_type = p_manifesto_type
  FROM elections e
  WHERE c.id = p_candidate_id
    AND e.id = c.election_id
    AND e.status = 'draft'
    AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not permitted: not your candidacy, or the election is no longer a draft.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_candidate_manifesto(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 6. RLS: votes — the core anonymity + one-vote-per-member guarantee
-- ------------------------------------------------------------

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- A voter may see their OWN vote row (so the UI can show "you voted for
-- X" / "you've already voted") but never anyone else's — including club
-- admins looking at their own membership, who only ever see their own
-- ballot through this policy, same as any other member.
CREATE POLICY "Members can see only their own vote."
  ON votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Approved members can cast exactly one vote while open."
  ON votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = votes.election_id
        AND e.status = 'open'
        AND NOW() < e.end_time
        AND public.is_approved_club_member(e.club_id, auth.uid())
    )
  );

-- Ballots are final once cast: no UPDATE or DELETE policies exist for
-- `votes` at all, for any role other than service_role. This is an
-- intentional omission, not an oversight — it keeps the audit trail
-- immutable and removes any lever (including the voter's own) for
-- tampering with a cast ballot.

-- ------------------------------------------------------------
-- 7. Anonymous aggregate results view
--
--    Ownership matters here: this view is created by the migration
--    role (a superuser in Supabase), which is naturally exempt from RLS
--    on every table it queries — including `votes`, whose own SELECT
--    policy would otherwise block this exact aggregation. The view's
--    WHERE clause below is what re-imposes the real access rules
--    (blind until end_time, club-members-only) using auth.uid(), which
--    still reflects the *querying* session regardless of view
--    ownership. The view never selects `user_id` at all — individual
--    ballots are structurally unreachable through it.
-- ------------------------------------------------------------

CREATE VIEW election_results AS
SELECT
  e.id AS election_id,
  c.id AS candidate_id,
  c.name AS candidate_name,
  COUNT(v.id)::INTEGER AS vote_count
FROM elections e
JOIN candidates c ON c.election_id = e.id
LEFT JOIN votes v ON v.candidate_id = c.id
WHERE
  e.status = 'closed'
  AND NOW() >= e.end_time
  AND public.is_approved_club_member(e.club_id, auth.uid())
GROUP BY e.id, c.id, c.name;

GRANT SELECT ON election_results TO authenticated;

-- ------------------------------------------------------------
-- 8. Tie handling: auto-extend by 24h, otherwise close
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_election(p_election_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  top_vote_count INTEGER;
  leader_count INTEGER;
BEGIN
  WITH tally AS (
    SELECT c.id, COUNT(v.id) AS vote_count
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    WHERE c.election_id = p_election_id
    GROUP BY c.id
  )
  SELECT MAX(vote_count) INTO top_vote_count FROM tally;

  -- No candidates, or nobody voted: nothing to tiebreak, just close it.
  IF top_vote_count IS NULL OR top_vote_count = 0 THEN
    UPDATE elections SET status = 'closed', updated_at = NOW() WHERE id = p_election_id;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO leader_count
  FROM (
    SELECT c.id
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    WHERE c.election_id = p_election_id
    GROUP BY c.id
    HAVING COUNT(v.id) = top_vote_count
  ) leaders;

  IF leader_count > 1 THEN
    -- Exact tie for first place: extend 24h and stay open for a runoff
    -- rather than arbitrarily picking a winner. Re-runs of this function
    -- (via the hourly cron job) handle a second consecutive tie the same
    -- way, so this naturally self-corrects without special-casing.
    UPDATE elections
    SET end_time = end_time + INTERVAL '24 hours',
        tie_extension_count = tie_extension_count + 1,
        updated_at = NOW()
    WHERE id = p_election_id;
  ELSE
    UPDATE elections SET status = 'closed', updated_at = NOW() WHERE id = p_election_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_finished_elections()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM elections WHERE status = 'open' AND end_time <= NOW()
  LOOP
    PERFORM public.resolve_election(rec.id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_election(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_finished_elections() TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-finished-elections') THEN
    PERFORM cron.unschedule('close-finished-elections');
  END IF;
END
$$;

SELECT cron.schedule(
  'close-finished-elections',
  '*/5 * * * *', -- every 5 minutes: elections are higher-stakes than the hourly event-completion job, worth finer granularity
  $$SELECT public.close_finished_elections();$$
);

-- ------------------------------------------------------------
-- 9. Storage: private bucket for candidate manifestos (video/PDF)
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'election-manifestos',
  'election-manifestos',
  false,
  104857600, -- 100 MB
  ARRAY['video/mp4', 'video/quicktime', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Files are stored at "{election_id}/{candidate_id}/...". This helper
-- mirrors is_club_admin()'s style for readability inside the storage
-- policies below, which can only work with the raw folder-name text.
CREATE OR REPLACE FUNCTION public.can_manage_manifesto(p_election_id UUID, p_candidate_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM elections e
    JOIN candidates c ON c.election_id = e.id
    WHERE e.id = p_election_id
      AND c.id = p_candidate_id
      AND e.status = 'draft'
      AND (
        c.user_id = auth.uid()
        OR public.is_club_admin(e.club_id, auth.uid())
        OR EXISTS (SELECT 1 FROM clubs WHERE id = e.club_id AND created_by = auth.uid())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_manifesto(UUID, UUID) TO authenticated, service_role;

CREATE POLICY "Club members can view manifestos in their club's elections."
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'election-manifestos'
    AND EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND public.is_approved_club_member(e.club_id, auth.uid())
    )
  );

CREATE POLICY "Candidates and admins can upload manifestos."
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'election-manifestos'
    AND public.can_manage_manifesto(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

CREATE POLICY "Candidates and admins can replace manifestos."
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'election-manifestos'
    AND public.can_manage_manifesto(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

CREATE POLICY "Candidates and admins can remove manifestos."
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'election-manifestos'
    AND public.can_manage_manifesto(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );
