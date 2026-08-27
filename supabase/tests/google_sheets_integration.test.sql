-- ============================================================
-- Test Suite: google_sheets_integration.test.sql
-- Description: Verifies Google Sheets integration schemas, RLS, and trigger function behaviors.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schemas
SELECT has_table('public', 'google_sheets_integrations', 'google_sheets_integrations table should exist');
SELECT has_column('public', 'google_sheets_integrations', 'club_id', 'google_sheets_integrations should have club_id column');
SELECT has_column('public', 'google_sheets_integrations', 'refresh_token', 'google_sheets_integrations should have refresh_token column');

SELECT has_table('public', 'event_google_sheets', 'event_google_sheets table should exist');
SELECT has_column('public', 'event_google_sheets', 'event_id', 'event_google_sheets should have event_id column');
SELECT has_column('public', 'event_google_sheets', 'spreadsheet_id', 'event_google_sheets should have spreadsheet_id column');

-- 2. Mock data
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000b11', 'admin-sheet@campus.edu'),
    ('00000000-0000-0000-0000-000000000b12', 'student-sheet@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000b11', 'Rob', 'Admin', 'rob_sheet_admin', 'admin-sheet@campus.edu'),
    ('00000000-0000-0000-0000-000000000b12', 'Sarah', 'Student', 'sarah_sheet_student', 'student-sheet@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000bc1',
    'Sheet Club',
    'sheet-club',
    '00000000-0000-0000-0000-000000000b11'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000be1',
    '00000000-0000-0000-0000-000000000bc1',
    'AI Sheets Lecture',
    'published',
    now() + INTERVAL '1 day',
    now() + INTERVAL '1 day 2 hours',
    '00000000-0000-0000-0000-000000000b11'
)
ON CONFLICT (id) DO NOTHING;

-- Associate Rob as admin of Sheet Club
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000bm1',
    '00000000-0000-0000-0000-000000000bc1',
    '00000000-0000-0000-0000-000000000b11',
    'admin',
    'approved'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert RLS prevents non-admins from inserting integrations
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000b12'; -- Sarah (not admin)

SELECT throws_ok(
    $$
    INSERT INTO public.google_sheets_integrations (club_id, refresh_token)
    VALUES ('00000000-0000-0000-0000-000000000bc1', 'mock_refresh_token_123');
    $$,
    'new row for relation "google_sheets_integrations" violates row-level security policy',
    'Non-admins should be blocked from inserting Google Sheet integrations by RLS'
);

-- 4. Assert RLS allows admins to insert integrations
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000b11'; -- Rob (admin)

SELECT lives_ok(
    $$
    INSERT INTO public.google_sheets_integrations (club_id, refresh_token)
    VALUES ('00000000-0000-0000-0000-000000000bc1', 'mock_refresh_token_123');
    $$,
    'Admins should be allowed to insert Google Sheet integrations'
);

ROLLBACK;
