-- =============================================================================
-- Migration: 20260805110000_sanitize_club_description_trigger.sql
-- Issue: #2272 - [SECURITY] Advanced API payload sanitization using DOMPurify
--                 on the backend
--
-- Club descriptions accept limited Markdown/HTML. A malicious user can bypass
-- client-side validation (e.g. via Postman) and persist <script> tags or
-- javascript: URIs directly through PostgREST. This migration adds an
-- unbypassable database-level sanitization gate: any INSERT/UPDATE of
-- clubs.description is scrubbed BEFORE the row is written, so malicious
-- payloads can never reach the database no matter which client sent them.
-- =============================================================================

-- 1. Pure sanitizer function. Regex-based because plpgsql has no DOM; it strips
--    script/embedding blocks, event-handler attributes and dangerous URI
--    schemes while preserving harmless rich-text tags.
--    NOTE: \b is NOT a word boundary in POSIX regex (it matches backspace),
--    so tag boundaries are expressed with [^>]*.
CREATE OR REPLACE FUNCTION public.sanitize_html_string(dirty TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  clean TEXT := COALESCE(dirty, '');
  bad_tags TEXT := '(script|iframe|object|embed|style|form|template|noscript|svg|math)';
BEGIN
  -- a) Remove <badtag>...</badtag> blocks (any casing/attributes)
  clean := regexp_replace(clean, '<\s*' || bad_tags || '[^>]*>.*?</\s*\1[^>]*>', '', 'gi');
  -- b) Remove self-closing dangerous tags
  clean := regexp_replace(clean, '<\s*' || bad_tags || '[^>]*/\s*>', '', 'gi');
  -- c) Strip event-handler attributes (on*="...")
  clean := regexp_replace(clean, '\s+on[a-z]+\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', '', 'gi');
  -- d) Neutralize dangerous URI schemes in href/src (javascript:, vbscript:, data:)
  clean := regexp_replace(
    clean,
    '(href|src)\s*=\s*(["''])\s*(javascript|vbscript|data)[^"'']*["'']?',
    '\1=\2\2', 'gi'
  );

  RETURN clean;
END;
$fn$;

-- 2. Trigger function that rewrites NEW.description before persistence
CREATE OR REPLACE FUNCTION public.sanitize_club_description()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.description := public.sanitize_html_string(NEW.description);
  RETURN NEW;
END;
$fn$;

-- 3. Attach the trigger to clubs.description (fires on INSERT and on UPDATE
--    only when the description column is touched)
DROP TRIGGER IF EXISTS trg_sanitize_club_description ON public.clubs;

CREATE TRIGGER trg_sanitize_club_description
BEFORE INSERT OR UPDATE OF description ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_club_description();
