-- Migration: 20260726000001_webauthn_challenge_index.sql
--
-- Adds a unique constraint + index on webauthn_challenges.challenge so
-- the new targeted challenge lookup in webauthn-auth-verify (which queries
-- by challenge value directly) is backed by an index.
--
-- Why unique: challenges are 32 cryptographically random bytes (base64url).
-- Duplicate values are statistically impossible (~1/2^256 collision) and
-- would indicate implementation error or tampering. Making the column unique:
--   1. Enforces correctness at the database level
--   2. Creates an implicit B-tree index that serves the .eq("challenge", …) query
--   3. Prevents hypothetical replay via duplicate row insertion

ALTER TABLE public.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_challenge_unique UNIQUE (challenge);

-- Paranoia index: if UNIQUE constraint above is not used as an index by the
-- planner for some reason, this partial index guarantees O(log n) lookup on
-- the hot path (valid, non-expired challenges of type authentication).
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_challenge_active
    ON public.webauthn_challenges (challenge)
    WHERE type = 'authentication';
