-- Migration: Add check constraint to the comments table content column
-- Blocks forbidden HTML tags (script, iframe, style, and other common
-- markup-injection vectors) from being stored in comment content.
--
-- Related issue: #502 - Add DB Check Constraints to Restrict Allowed HTML Tags in Comments
--
-- This enforces security at the database layer so that even if application-
-- level validation is bypassed, dangerous markup cannot be persisted.

-- Drop the constraint if it already exists (keeps the migration idempotent
-- so it can be re-applied without errors).
ALTER TABLE public.comments
    DROP CONSTRAINT IF EXISTS check_comments_content_html_tags;

-- Add a CHECK constraint using the case-insensitive negated regex operator (!~*)
-- that rejects any comment content containing an opening or closing tag of a
-- known dangerous HTML element.
--
-- Covered tags:
--   script, iframe, style  -> explicitly required by the issue
--   object, embed, applet  -> legacy plugin/media injection vectors
--   link, meta, base       -> head-element injection / resource hijacking
--   form                   -> credential harvesting / phishing
--   frame, frameset        -> legacy framing / clickjacking
--   svg                    -> inline SVG-based XSS payloads
ALTER TABLE public.comments
    ADD CONSTRAINT check_comments_content_html_tags
    CHECK (
        content !~* '<\s*/?\s*(script|iframe|style|object|embed|link|meta|base|form|frame|frameset|applet|svg)\b'
    );
