-- Test file: supabase/tests/club_social_url_constraints.test.sql
-- Issue: #1296 – strict social media URL format check constraints
--
-- These pgTAP tests verify that the per-platform CHECK constraints on the
-- `social_links` JSONB column correctly accept valid full URLs and reject
-- invalid strings such as bare @usernames, handles, or wrong domains.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(18);

-- ════════════════════════════════════════════════════════════════════════════
-- 1.  Constraints exist
-- ════════════════════════════════════════════════════════════════════════════

SELECT has_check(
    'public', 'clubs',
    'Clubs table should have a check constraint for linkedin URL'
);

SELECT constraint_col_is(
    'public', 'clubs', 'check_clubs_linkedin_url_format',
    ARRAY['social_links'],
    'check_clubs_linkedin_url_format should operate on social_links'
);

SELECT constraint_col_is(
    'public', 'clubs', 'check_clubs_twitter_url_format',
    ARRAY['social_links'],
    'check_clubs_twitter_url_format should operate on social_links'
);

SELECT constraint_col_is(
    'public', 'clubs', 'check_clubs_instagram_url_format',
    ARRAY['social_links'],
    'check_clubs_instagram_url_format should operate on social_links'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2.  NULL / empty values are always accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_null_links AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Null Links Club', 'null-links-club', NULL);
SELECT lives_ok('insert_null_links', 'NULL social_links should be allowed');

PREPARE insert_empty_links AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Empty Links Club', 'empty-links-club', '{}'::jsonb);
SELECT lives_ok('insert_empty_links', 'Empty social_links object should be allowed');

-- ════════════════════════════════════════════════════════════════════════════
-- 3.  Valid LinkedIn URLs are accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_valid_linkedin AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('LinkedIn Club', 'linkedin-valid-club',
            '{"linkedin": "https://linkedin.com/company/campusconnect"}'::jsonb);
SELECT lives_ok('insert_valid_linkedin', 'Valid linkedin.com URL should be accepted');

PREPARE insert_valid_linkedin_www AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('LinkedIn WWW Club', 'linkedin-www-club',
            '{"linkedin": "https://www.linkedin.com/in/johndoe"}'::jsonb);
SELECT lives_ok('insert_valid_linkedin_www', 'Valid www.linkedin.com URL should be accepted');

-- ════════════════════════════════════════════════════════════════════════════
-- 4.  Invalid LinkedIn values are rejected
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_linkedin_handle AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('LinkedIn Handle Club', 'linkedin-handle-club',
            '{"linkedin": "@johndoe"}'::jsonb);
SELECT throws_ok(
    'insert_linkedin_handle', '23514', NULL,
    '@handle should be rejected for linkedin URL'
);

PREPARE insert_linkedin_wrong_domain AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('LinkedIn Wrong Club', 'linkedin-wrong-club',
            '{"linkedin": "https://facebook.com/johndoe"}'::jsonb);
SELECT throws_ok(
    'insert_linkedin_wrong_domain', '23514', NULL,
    'Wrong domain should be rejected for linkedin URL'
);

PREPARE insert_linkedin_no_scheme AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('LinkedIn No Scheme Club', 'linkedin-noscheme-club',
            '{"linkedin": "linkedin.com/in/johndoe"}'::jsonb);
SELECT throws_ok(
    'insert_linkedin_no_scheme', '23514', NULL,
    'URL without https:// scheme should be rejected for linkedin'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5.  Valid Twitter / X URLs are accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_valid_twitter AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Twitter Club', 'twitter-valid-club',
            '{"twitter": "https://twitter.com/campusconnect"}'::jsonb);
SELECT lives_ok('insert_valid_twitter', 'Valid twitter.com URL should be accepted');

PREPARE insert_valid_x AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('X Club', 'x-valid-club',
            '{"twitter": "https://x.com/campusconnect"}'::jsonb);
SELECT lives_ok('insert_valid_x', 'Valid x.com URL should be accepted');

-- ════════════════════════════════════════════════════════════════════════════
-- 6.  Invalid Twitter values are rejected
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_twitter_handle AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Twitter Handle Club', 'twitter-handle-club',
            '{"twitter": "@campusconnect"}'::jsonb);
SELECT throws_ok(
    'insert_twitter_handle', '23514', NULL,
    '@handle should be rejected for twitter URL'
);

PREPARE insert_twitter_wrong_domain AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Twitter Wrong Domain', 'twitter-wrong-domain',
            '{"twitter": "https://instagram.com/campusconnect"}'::jsonb);
SELECT throws_ok(
    'insert_twitter_wrong_domain', '23514', NULL,
    'Wrong domain should be rejected for twitter URL'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 7.  Valid Instagram URLs are accepted
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_valid_instagram AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Instagram Club', 'instagram-valid-club',
            '{"instagram": "https://instagram.com/campusconnect"}'::jsonb);
SELECT lives_ok('insert_valid_instagram', 'Valid instagram.com URL should be accepted');

PREPARE insert_valid_instagram_www AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Instagram WWW Club', 'instagram-www-club',
            '{"instagram": "https://www.instagram.com/campusconnect"}'::jsonb);
SELECT lives_ok('insert_valid_instagram_www', 'Valid www.instagram.com URL should be accepted');

-- ════════════════════════════════════════════════════════════════════════════
-- 8.  Invalid Instagram values are rejected
-- ════════════════════════════════════════════════════════════════════════════

PREPARE insert_instagram_handle AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Instagram Handle Club', 'instagram-handle-club',
            '{"instagram": "@campusconnect"}'::jsonb);
SELECT throws_ok(
    'insert_instagram_handle', '23514', NULL,
    '@handle should be rejected for instagram URL'
);

PREPARE insert_instagram_wrong_domain AS
    INSERT INTO public.clubs (name, slug, social_links)
    VALUES ('Instagram Wrong Domain', 'instagram-wrong-domain',
            '{"instagram": "https://tiktok.com/campusconnect"}'::jsonb);
SELECT throws_ok(
    'insert_instagram_wrong_domain', '23514', NULL,
    'Wrong domain should be rejected for instagram URL'
);

SELECT * FROM finish();
ROLLBACK;
