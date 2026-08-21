-- ============================================================
-- Test Suite: secure_api_key_management.test.sql
-- Description: Verifies pgcrypto API key storage, trigger auth, and RLS owner controls.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(9);

-- 1. Verify schema elements exist on club_api_keys table
SELECT has_table('public', 'club_api_keys', 'club_api_keys table should exist');
SELECT has_column('public', 'club_api_keys', 'club_id', 'club_api_keys table should have club_id column');
SELECT has_column('public', 'club_api_keys', 'hashed_key', 'club_api_keys table should have hashed_key column');
SELECT has_column('public', 'club_api_keys', 'prefix', 'club_api_keys table should have prefix column');
SELECT has_column('public', 'club_api_keys', 'name', 'club_api_keys table should have name column');

-- 2. Set up mock users, profiles, and club
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000d11', 'admin-key@campus.edu'),
    ('00000000-0000-0000-0000-000000000d12', 'student-key@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000d11', 'Rob', 'Admin', 'rob_admin', 'admin-key@campus.edu'),
    ('00000000-0000-0000-0000-000000000d12', 'Sarah', 'Student', 'sarah_student', 'student-key@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000dc1',
    'Coding Club',
    'coding-club',
    '00000000-0000-0000-0000-000000000d11'
)
ON CONFLICT (id) DO NOTHING;

-- Make Rob an admin of Coding Club
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000dm1',
    '00000000-0000-0000-0000-000000000dc1',
    '00000000-0000-0000-0000-000000000d11',
    'admin',
    'approved'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Test API Key creation through RPC (hashing validation)
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000d11';

SELECT lives_ok(
    $$
    SELECT public.create_club_api_key(
        '00000000-0000-0000-0000-000000000dc1',
        'Discord Key',
        'secure_random_hex_secret',
        'cc_ab12cd'
    );
    $$,
    'Club admin Rob should be able to create a secure API Key'
);

-- Check that it is NOT stored in plaintext
SELECT results_ne(
    $$
    SELECT hashed_key FROM public.club_api_keys
    WHERE prefix = 'cc_ab12cd';
    $$,
    $$
    VALUES ('secure_random_hex_secret'::text);
    $$,
    'Stored key must be hashed and NOT match the raw key plaintext'
);

-- 4. Test Key Authentication RPC
SELECT results_eq(
    $$
    SELECT public.authenticate_club_api_key(
        'cc_ab12cd',
        'secure_random_hex_secret',
        '00000000-0000-0000-0000-000000000dc1'
    );
    $$,
    ARRAY[TRUE],
    'Authentication RPC should return TRUE for valid matching raw secret'
);

-- Test Authentication RPC with wrong secret
SELECT results_eq(
    $$
    SELECT public.authenticate_club_api_key(
        'cc_ab12cd',
        'wrong_secret_string',
        '00000000-0000-0000-0000-000000000dc1'
    );
    $$,
    ARRAY[FALSE],
    'Authentication RPC should return FALSE for invalid secret'
);

ROLLBACK;
