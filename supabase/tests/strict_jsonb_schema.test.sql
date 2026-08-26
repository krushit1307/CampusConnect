-- Test file: supabase/tests/strict_jsonb_schema.test.sql
-- Issue: #2157 – Strict JSONB schema validation using Postgres constraints

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- 1. Constraint exists on public.profiles
SELECT has_check(
    'public', 'profiles',
    'profiles table should have check_settings_schema constraint'
);

SELECT constraint_col_is(
    'public', 'profiles', 'check_settings_schema',
    ARRAY['settings'],
    'check_settings_schema constraint should operate on settings column'
);

-- 2. Valid JSON payload passes
PREPARE valid_settings AS
    INSERT INTO public.profiles (id, first_name, last_name, settings)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Test', 'User',
            '{"theme": "dark", "email_notifications": true}'::jsonb);
SELECT lives_ok('valid_settings', 'Valid JSON payload with boolean email_notifications and string theme should be accepted');

-- 3. Invalid JSON payload with string instead of boolean is rejected
PREPARE invalid_string_bool AS
    INSERT INTO public.profiles (id, first_name, last_name, settings)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Test', 'User',
            '{"theme": "dark", "email_notifications": "true_string"}'::jsonb);
SELECT throws_ok(
    'invalid_string_bool', '23514', NULL,
    'String payload for email_notifications should throw constraint violation 23514'
);

-- 4. Invalid JSON payload missing required keys is rejected
PREPARE invalid_missing_key AS
    INSERT INTO public.profiles (id, first_name, last_name, settings)
    VALUES ('00000000-0000-0000-0000-000000000003', 'Test', 'User',
            '{"theme": "dark"}'::jsonb);
SELECT throws_ok(
    'invalid_missing_key', '23514', NULL,
    'JSON payload missing email_notifications key should throw constraint violation 23514'
);

-- 5. Invalid JSON payload with non-string theme is rejected
PREPARE invalid_non_string_theme AS
    INSERT INTO public.profiles (id, first_name, last_name, settings)
    VALUES ('00000000-0000-0000-0000-000000000004', 'Test', 'User',
            '{"theme": 123, "email_notifications": true}'::jsonb);
SELECT throws_ok(
    'invalid_non_string_theme', '23514', NULL,
    'Non-string theme should throw constraint violation 23514'
);

SELECT * FROM finish();
ROLLBACK;
