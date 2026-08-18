-- ============================================================
-- Test Suite: automated_event_certificate_revocation.test.sql
-- Description: Verifies schema, triggers, and rollback mechanics of certificate revocations.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Verify schema elements exist
SELECT has_table('public', 'certificate_revocations', 'certificate_revocations table should exist');
SELECT has_column('public', 'certificate_revocations', 'hash', 'certificate_revocations should have hash column');
SELECT has_column('public', 'certificate_revocations', 'revoked_at', 'certificate_revocations should have revoked_at column');
SELECT has_column('public', 'certificate_revocations', 'reason', 'certificate_revocations should have reason column');
SELECT has_column('public', 'certificate_revocations', 'revoked_by', 'certificate_revocations should have revoked_by column');

-- 2. Setup mock data
-- Create user
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-0000000000aa', 'Revocation Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Create club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000bb', 'Cert Club', 'cert-club')
ON CONFLICT (id) DO NOTHING;

-- Create event
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, event_date, generates_certificate)
VALUES ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb', 'Cert Event', 100, 100, NOW() + INTERVAL '1 day', true)
ON CONFLICT (id, club_id) DO NOTHING;

-- Create RSVP
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, club_id)
VALUES ('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'approved', false, '00000000-0000-0000-0000-0000000000bb')
ON CONFLICT (id, club_id) DO NOTHING;

-- Insert Mock Certificate
INSERT INTO public.certificates (id, event_id, user_id, attendee_name, event_title, event_date, certificate_url, verification_hash, club_id)
VALUES ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'Revocation Student', 'Cert Event', NOW(), 'https://storage/cert.pdf', 'test_cert_hash_xyz_123', '00000000-0000-0000-0000-0000000000bb')
ON CONFLICT (id, club_id) DO NOTHING;

-- Set session config
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa"}', true);

-- Assertions on initial state
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.certificate_revocations $$,
    $$ VALUES (0) $$,
    'Initial revocations count should be 0'
);

-- Trigger check-in to TRUE (no revocation should occur, it is checking in)
UPDATE public.event_rsvps
SET checked_in = true
WHERE id = '00000000-0000-0000-0000-0000000000dd';

SELECT results_eq(
    $$ SELECT count(*)::int FROM public.certificate_revocations $$,
    $$ VALUES (0) $$,
    'Revocations count should remain 0 after check-in'
);

-- Trigger check-in back to FALSE (Revocation trigger fires)
UPDATE public.event_rsvps
SET checked_in = false
WHERE id = '00000000-0000-0000-0000-0000000000dd';

-- Assert revocation record got inserted
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.certificate_revocations $$,
    $$ VALUES (1) $$,
    'Revocation record should be automatically inserted when checked_in goes from true to false'
);

-- Assert certificate_url got updated to 'revoked'
SELECT results_eq(
    $$ SELECT certificate_url FROM public.certificates WHERE id = '00000000-0000-0000-0000-0000000000ee' $$,
    $$ VALUES ('revoked') $$,
    'Certificate URL should be updated to revoked'
);

-- Trigger check-in back to TRUE (Undo trigger fires)
UPDATE public.event_rsvps
SET checked_in = true
WHERE id = '00000000-0000-0000-0000-0000000000dd';

-- Assert revocation record got deleted (Undo successful)
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.certificate_revocations $$,
    $$ VALUES (0) $$,
    'Revocation record should be deleted when check-in is undone'
);

ROLLBACK;
