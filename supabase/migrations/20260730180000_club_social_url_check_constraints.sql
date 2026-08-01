-- Migration: 20260730180000_club_social_url_check_constraints.sql
-- Issue: #1296
-- Description:
--   Add strict per-column CHECK constraints to the `clubs` table for the
--   three social-media URL fields stored inside the `social_links` JSONB
--   column (linkedin, twitter/x, instagram).
--
--   Club admins sometimes enter "@username" or bare handles instead of a
--   full URL, which breaks every rendered <a href="..."> on the frontend.
--   Enforcing the pattern at the database level prevents any invalid value
--   from ever being persisted, regardless of which client (web app, API
--   call, migration script, …) performs the write.
--
--   Pattern requirements per field:
--     - linkedin  : https://(www.)linkedin.com/…
--     - twitter   : https://(www.)twitter.com/…  OR  https://(www.)x.com/…
--     - instagram : https://(www.)instagram.com/…
--
--   Each constraint is only applied when the key is present and non-empty
--   inside the JSONB object, so clubs that have not set a particular social
--   link are unaffected (NULL / missing key is always valid).

-- ─── helper: extract a key from social_links safely ────────────────────────
-- We use the JSONB ->> operator inline inside the CHECK expressions so that
-- no extra stored functions are required.  The regex operator `~` performs a
-- case-sensitive POSIX match.

-- ─── linkedin constraint ────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'check_clubs_linkedin_url_format'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_linkedin_url_format CHECK (
            (social_links ->> 'linkedin') IS NULL
            OR (social_links ->> 'linkedin') = ''
            OR (social_links ->> 'linkedin') ~ '^https://(www\.)?linkedin\.com/.+'
        );
    END IF;
END $$;

-- ─── twitter / X constraint ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'check_clubs_twitter_url_format'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_twitter_url_format CHECK (
            (social_links ->> 'twitter') IS NULL
            OR (social_links ->> 'twitter') = ''
            OR (social_links ->> 'twitter') ~ '^https://(www\.)?(twitter|x)\.com/.+'
        );
    END IF;
END $$;

-- ─── instagram constraint ───────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'check_clubs_instagram_url_format'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_instagram_url_format CHECK (
            (social_links ->> 'instagram') IS NULL
            OR (social_links ->> 'instagram') = ''
            OR (social_links ->> 'instagram') ~ '^https://(www\.)?instagram\.com/.+'
        );
    END IF;
END $$;

-- ─── comment / rollback guidance ────────────────────────────────────────────
-- To roll back this migration run:
--
--   ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS check_clubs_linkedin_url_format;
--   ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS check_clubs_twitter_url_format;
--   ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS check_clubs_instagram_url_format;
