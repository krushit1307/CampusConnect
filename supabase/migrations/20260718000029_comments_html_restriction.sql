-- Migration: Add check constraint to the comments table content column
-- Blocks forbidden HTML tags (script, iframe, style, and other common
-- markup-injection vectors) from being stored in comment content.

ALTER TABLE public.comments
ADD CONSTRAINT check_comments_content_html_tags
CHECK (
    content !~* '<\s*/?\s*(script|iframe|style|object|embed|link|meta|base|form|frame|frameset|applet|svg)\b'
);
