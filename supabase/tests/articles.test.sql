-- ============================================================
-- Test Suite: articles.test.sql
-- Issue: #1964
-- Description: Verifies articles table, estimated read time calculations
--              for words and image count buffers.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- Test 1: Check articles table exists
SELECT has_table('public', 'articles', 'Table articles should exist');

-- Test 2: Check columns on articles table
SELECT has_column('public', 'articles', 'id', 'Column id should exist on articles');
SELECT has_column('public', 'articles', 'club_id', 'Column club_id should exist on articles');
SELECT has_column('public', 'articles', 'author_id', 'Column author_id should exist on articles');
SELECT has_column('public', 'articles', 'title', 'Column title should exist on articles');
SELECT has_column('public', 'articles', 'content', 'Column content should exist on articles');
SELECT has_column('public', 'articles', 'read_time_minutes', 'Column read_time_minutes should exist on articles');

-- Setup test profile and club
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000001', 'articlescreator@test.com', 'authenticated', 'authenticated', '{"full_name": "Article Creator"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('90000000-0000-0000-0000-000000000001', 'Article', 'Creator', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000002', 'News Club', 'news-club', 'News club description', '90000000-0000-0000-0000-000000000001');

-- Test 3: Insert article with exactly 450 words of lorem ipsum and no images
-- 450 words / 225 wpm = 2.0 minutes, which ceil()s to 2.
INSERT INTO public.articles (id, club_id, author_id, title, content)
VALUES (
  '90000000-0000-0000-0000-000000000003',
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000001',
  'Test Article 450 Words',
  trim(repeat('lorem ', 450))
);

SELECT is(
  (SELECT read_time_minutes FROM public.articles WHERE id = '90000000-0000-0000-0000-000000000003'),
  2,
  'Article with 450 words and 0 images should estimate exactly 2 minutes read time'
);

-- Test 4: Insert article with 450 words and 1 image
-- 450 words = 120 seconds. 1 image adds 12 seconds = 132 seconds total.
-- 132 seconds / 60 = 2.2 minutes, which ceil()s to 3.
INSERT INTO public.articles (id, club_id, author_id, title, content)
VALUES (
  '90000000-0000-0000-0000-000000000004',
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000001',
  'Test Article 450 Words 1 Image',
  trim(repeat('lorem ', 450)) || ' <img src="test.jpg" />'
);

SELECT is(
  (SELECT read_time_minutes FROM public.articles WHERE id = '90000000-0000-0000-0000-000000000004'),
  3,
  'Article with 450 words and 1 image should estimate 3 minutes read time'
);

ROLLBACK;
