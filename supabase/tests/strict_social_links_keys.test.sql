-- Test file: supabase/tests/strict_social_links_keys.test.sql
-- Issue: #2305 – Strictly validate social_links JSON schema keys in Postgres

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- 1. Check constraint exists
SELECT has_check(
  'public', 'clubs',
  'Clubs table should have a check constraint for valid_social_keys'
);

-- 2. Valid keys allowed (instagram, twitter, linkedin, website, github)
PREPARE insert_allowed_keys AS
  INSERT INTO public.clubs (name, slug, social_links)
  VALUES ('Allowed Keys Club', 'allowed-keys-club',
          '{"instagram": "https://instagram.com/club", "github": "https://github.com/club"}'::jsonb);
SELECT lives_ok('insert_allowed_keys', 'Inserting allowed social_links keys should succeed');

-- 3. Update with valid allowlist keys succeeds
PREPARE update_valid_key AS
  UPDATE public.clubs
  SET social_links = '{"instagram": "https://instagram.com/updated"}'::jsonb
  WHERE slug = 'allowed-keys-club';
SELECT lives_ok('update_valid_key', 'UPDATE with valid instagram key should succeed');

-- 4. Reject unrecognized key (e.g. tiktok)
PREPARE insert_invalid_key AS
  INSERT INTO public.clubs (name, slug, social_links)
  VALUES ('Invalid Key Club', 'invalid-key-club',
          '{"instagram": "https://instagram.com/club", "tiktok": "https://tiktok.com/@club"}'::jsonb);
SELECT throws_ok(
  'insert_invalid_key', '23514', NULL,
  'Inserting unrecognized key tiktok into social_links should be rejected'
);

-- 5. Reject update with unrecognized key (e.g. hacked_key)
PREPARE update_hacked_key AS
  UPDATE public.clubs
  SET social_links = '{"instagram": "https://instagram.com/url", "hacked_key": true}'::jsonb
  WHERE slug = 'allowed-keys-club';
SELECT throws_ok(
  'update_hacked_key', '23514', NULL,
  'UPDATE with unrecognized key hacked_key should be rejected'
);

-- 6. Null and empty jsonb accepted
PREPARE insert_empty_jsonb AS
  INSERT INTO public.clubs (name, slug, social_links)
  VALUES ('Empty JSONB Club', 'empty-jsonb-club', '{}'::jsonb);
SELECT lives_ok('insert_empty_jsonb', 'Empty jsonb object should be allowed');

SELECT * FROM finish();
ROLLBACK;
