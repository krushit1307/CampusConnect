-- =============================================================================
-- Test: sanitize_club_description_trigger.test.sql
-- Purpose: Verify that the DB-level XSS sanitizer strips malicious HTML/JS from
--          clubs.description before persistence (INSERT and UPDATE), neutralizing
--          script tags, event handlers and javascript:/vbscript:/data: URIs while
--          preserving harmless rich text. (Issue #2272)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. The sanitizer function exists
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sanitize_html_string'
  ),
  'sanitize_html_string function should exist'
);

-- 2. The trigger is bound to clubs
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_sanitize_club_description'
      AND c.relname = 'clubs'
  ),
  'trg_sanitize_club_description trigger should exist on clubs'
);

-- Setup: mock seed club (a fresh INSERT is scrubbed by the trigger too)
INSERT INTO public.clubs (id, name, slug, description)
VALUES ('90000000-0000-0000-0000-000000000a01', 'Sanitize Test', 'sanitize-test', 'seed')
ON CONFLICT (id) DO NOTHING;

-- 3. UPDATE strips <script> blocks and neutralizes javascript: URIs
UPDATE public.clubs
SET description = '<b>Hello</b> <script>alert(1)</script> <a href=''javascript:alert(2)'' >Click</a>'
WHERE id = '90000000-0000-0000-0000-000000000a01';

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a01'),
  '<b>Hello</b>  <a href='''' >Click</a>',
  'UPDATE strips script tag and neutralizes javascript: href'
);

-- 4. UPDATE strips on* event handlers / embeds
UPDATE public.clubs
SET description = '<p onclick="alert(1)">x</p><iframe src="http://evil.com"></iframe><b>ok</b>'
WHERE id = '90000000-0000-0000-0000-000000000a01';

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a01'),
  '<p>x</p><b>ok</b>',
  'UPDATE strips event handlers and removes iframe blocks'
);

-- 5. A fresh INSERT with a malicious payload is scrubbed on write
INSERT INTO public.clubs (id, name, slug, description)
VALUES ('90000000-0000-0000-0000-000000000a02', 'Sanitize Test 2', 'sanitize-test-2',
        '<b>safe</b> <script>alert(1)</script>');

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a02'),
  '<b>safe</b> ',
  'INSERT with script tag persists only the harmless tag'
);

-- 6. vbscript: and data: URI schemes are neutralized
UPDATE public.clubs
SET description = '<a href="vbscript:msgbox(1)">v</a> <a href="data:text/html,<script>alert(1)</script>">d</a>'
WHERE id = '90000000-0000-0000-0000-000000000a01';

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a01'),
  '<a href="">v</a> <a href="">d</a>',
  'vbscript: and data: URI schemes are neutralized to empty href'
);

-- 7. Style blocks (CSS injection) are removed
UPDATE public.clubs
SET description = '<STYLE>body{display:none}</STYLE><b>kept</b>'
WHERE id = '90000000-0000-0000-0000-000000000a01';

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a01'),
  '<b>kept</b>',
  'style blocks are removed'
);

-- 8. Legitimate http(s) links are preserved
UPDATE public.clubs
SET description = '<a href="https://example.com">ok</a>'
WHERE id = '90000000-0000-0000-0000-000000000a01';

SELECT is(
  (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000a01'),
  '<a href="https://example.com">ok</a>',
  'legitimate https links are preserved'
);

SELECT * FROM finish();
ROLLBACK;