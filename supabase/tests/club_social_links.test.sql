-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- Test 1: Check column social_links exists on clubs table
SELECT has_column('public', 'clubs', 'social_links', 'Column social_links should exist on clubs table');

-- Test 2: Check column default value is '{}'::jsonb
SELECT col_default_is('public', 'clubs', 'social_links', '{}'::jsonb, 'Default social_links should be empty jsonb object');

-- Test 3: Test valid social links insertion
PREPARE insert_valid_social_links AS 
  INSERT INTO public.clubs (name, slug, social_links) 
  VALUES ('Valid Social Club', 'valid-social-club', '{"instagram": "https://instagram.com/valid", "discord": "https://discord.gg/valid"}'::jsonb);
SELECT lives_ok('insert_valid_social_links', 'Valid social_links with http/https URLs should be allowed');

-- Test 4: Test invalid social links insertion (should throw constraint error)
PREPARE insert_invalid_social_links AS 
  INSERT INTO public.clubs (name, slug, social_links) 
  VALUES ('Invalid Social Club', 'invalid-social-club', '{"instagram": "ftp://invalid-url"}'::jsonb);
SELECT throws_ok('insert_invalid_social_links', '23514', NULL, 'Invalid social_links URL without http/https should be rejected');

-- Finish tests and clean up
SELECT * FROM finish();
ROLLBACK;
