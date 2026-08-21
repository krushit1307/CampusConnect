-- pgTAP Test: Club Constitution / Bylaws Signature Tracking (Issue #3188)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

-- Test 1-2: clubs columns
SELECT has_column('public', 'clubs', 'bylaws_version', 'Column bylaws_version should exist on clubs');
SELECT col_is_not_null('public', 'clubs', 'bylaws_version', 'bylaws_version should be NOT NULL');

-- Test 3-6: club_roles signature columns
SELECT has_column('public', 'club_roles', 'signed_bylaws_at', 'Column signed_bylaws_at should exist on club_roles');
SELECT has_column('public', 'club_roles', 'signature_hash', 'Column signature_hash should exist on club_roles');
SELECT has_column('public', 'club_roles', 'bylaws_version_signed', 'Column bylaws_version_signed should exist on club_roles');
SELECT has_column('public', 'club_roles', 'signed_ip', 'Column signed_ip should exist on club_roles');

-- Setup test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('81000000-0000-0000-0000-000000000001', 'exec@test.com', 'authenticated', 'authenticated', '{"full_name": "Exec User"}')
ON CONFLICT (id) DO NOTHING;

-- Insert club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('81000000-0000-0000-0000-000000000003', 'Bylaws Test Club', 'bylaws-test-club', 'Testing bylaws', '81000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert role (unsigned by default)
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES ('81000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000003', 'President', 100)
ON CONFLICT (id) DO NOTHING;

-- Test 7-8: default state (bylaws_version defaults to 1, signature columns NULL)
SELECT results_eq(
    'SELECT bylaws_version FROM public.clubs WHERE id = ''81000000-0000-0000-0000-000000000003''',
    ARRAY[1],
    'bylaws_version should default to 1'
);
SELECT is_empty(
    'SELECT 1 FROM public.club_roles WHERE id = ''81000000-0000-0000-0000-000000000004'' AND signature_hash IS NOT NULL',
    'New roles should start unsigned (signature_hash NULL)'
);

-- Simulate a signed role
UPDATE public.club_roles
SET signed_bylaws_at = NOW(),
    signature_hash = 'abc123',
    bylaws_version_signed = 1,
    signed_ip = '127.0.0.1'
WHERE id = '81000000-0000-0000-0000-000000000004';

-- Test 9-11: signature persisted
SELECT results_eq(
    'SELECT signature_hash FROM public.club_roles WHERE id = ''81000000-0000-0000-0000-000000000004''',
    ARRAY['abc123'],
    'signature_hash should persist after signing'
);
SELECT results_eq(
    'SELECT bylaws_version_signed FROM public.club_roles WHERE id = ''81000000-0000-0000-0000-000000000004''',
    ARRAY[1],
    'bylaws_version_signed should record the signed version'
);
SELECT results_eq(
    'SELECT signed_ip FROM public.club_roles WHERE id = ''81000000-0000-0000-0000-000000000004''',
    ARRAY['127.0.0.1'],
    'signed_ip should persist'
);

-- Test 12: bumping bylaws_version + nulling signatures (the re-sign flow)
UPDATE public.clubs SET bylaws_version = bylaws_version + 1 WHERE id = '81000000-0000-0000-0000-000000000003';
UPDATE public.club_roles
SET signed_bylaws_at = NULL,
    signature_hash = NULL,
    bylaws_version_signed = NULL,
    signed_ip = NULL
WHERE club_id = '81000000-0000-0000-0000-000000000003';

SELECT results_eq(
    'SELECT bylaws_version FROM public.clubs WHERE id = ''81000000-0000-0000-0000-000000000003''',
    ARRAY[2],
    'bylaws_version should increment on update'
);
