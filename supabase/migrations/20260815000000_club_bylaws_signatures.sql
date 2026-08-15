-- =============================================================================
-- Migration: Club Constitution / Bylaws Signature Tracking
-- Issue: #3188
-- Description:
--   Tracks whether club executives have read and digitally signed the club's
--   current constitution/bylaws.
--
--   - clubs.constitution_url          existing column (uploaded constitution PDF)
--   - clubs.bylaws_version            incremented whenever the constitution is
--                                     replaced, which invalidates all signatures
--                                     for that club (forces re-signing)
--   - club_roles.signed_bylaws_at     timestamp of the latest signature
--   - club_roles.signature_hash       SHA-256 of (user, club, role, version,
--                                     signature image, ip, timestamp)
--   - club_roles.bylaws_version_signed the bylaws version that was signed
--   - club_roles.signed_ip            IP address captured at signing time
-- =============================================================================

-- 1. Bylaws version tracker on clubs (defaults to 1 = first constitution)
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS bylaws_version INTEGER NOT NULL DEFAULT 1;

-- 2. Signature columns on club_roles
ALTER TABLE public.club_roles
    ADD COLUMN IF NOT EXISTS signed_bylaws_at TIMESTAMPTZ;
ALTER TABLE public.club_roles
    ADD COLUMN IF NOT EXISTS signature_hash TEXT;
ALTER TABLE public.club_roles
    ADD COLUMN IF NOT EXISTS bylaws_version_signed INTEGER;
ALTER TABLE public.club_roles
    ADD COLUMN IF NOT EXISTS signed_ip TEXT;

-- 3. Index for the compliance scan (unsigned active roles)
CREATE INDEX IF NOT EXISTS idx_club_roles_signature
    ON public.club_roles (signature_hash)
    WHERE signature_hash IS NULL;
