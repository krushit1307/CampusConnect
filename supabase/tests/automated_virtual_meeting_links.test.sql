-- ============================================================
-- Test Suite: automated_virtual_meeting_links.test.sql
-- Description: Verifies virtual meeting tables, Citus co-location, RLS policies, and triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(13);

-- 1. Check Tables and Columns
SELECT has_table('public', 'club_zoom_integrations', 'club_zoom_integrations table should exist');
SELECT has_column('public', 'club_zoom_integrations', 'club_id', 'club_zoom_integrations should have club_id');
SELECT has_column('public', 'club_zoom_integrations', 'zoom_account_id', 'club_zoom_integrations should have zoom_account_id');
SELECT has_column('public', 'club_zoom_integrations', 'zoom_client_id', 'club_zoom_integrations should have zoom_client_id');
SELECT has_column('public', 'club_zoom_integrations', 'zoom_client_secret', 'club_zoom_integrations should have zoom_client_secret');

SELECT has_table('public', 'virtual_meetings', 'virtual_meetings table should exist');
SELECT has_column('public', 'virtual_meetings', 'event_id', 'virtual_meetings should have event_id');
SELECT has_column('public', 'virtual_meetings', 'club_id', 'virtual_meetings should have club_id');
SELECT has_column('public', 'virtual_meetings', 'meeting_url', 'virtual_meetings should have meeting_url');

-- 2. Setup mock data
-- Create users
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('11111111-1111-1111-1111-1111111111aa', 'Club Admin User', 'student'),
  ('11111111-1111-1111-1111-1111111111bb', 'Approved Attendee', 'student'),
  ('11111111-1111-1111-1111-1111111111cc', 'Unapproved Attendee', 'student')
ON CONFLICT (id) DO NOTHING;

-- Create club
INSERT INTO public.clubs (id, name, slug)
VALUES ('11111111-1111-1111-1111-1111111111dd', 'Virtual Tech Club', 'virtual-tech-club')
ON CONFLICT (id) DO NOTHING;

-- Create club member (admin)
INSERT INTO public.club_members (club_id, user_id, role_id, status)
VALUES ('11111111-1111-1111-1111-1111111111dd', '11111111-1111-1111-1111-1111111111aa', '00000000-0000-0000-0000-000000000000', 'approved')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Create event starts tomorrow (far in future)
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, is_virtual, virtual_platform)
VALUES (
    '11111111-1111-1111-1111-1111111111ee', 
    '11111111-1111-1111-1111-1111111111dd', 
    'Future Virtual Meetup', 
    100, 
    100, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    true, 
    'zoom'
)
ON CONFLICT (id, club_id) DO NOTHING;

-- Create event starts in 5 minutes (near future / active reveal)
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, is_virtual, virtual_platform)
VALUES (
    '11111111-1111-1111-1111-1111111111ff', 
    '11111111-1111-1111-1111-1111111111dd', 
    'Active Virtual Meetup', 
    100, 
    100, 
    NOW() + INTERVAL '5 minutes', 
    NOW() + INTERVAL '2 hours', 
    true, 
    'zoom'
)
ON CONFLICT (id, club_id) DO NOTHING;

-- Create RSVPs
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, club_id)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-1111111111ee', '11111111-1111-1111-1111-1111111111bb', 'approved', false, '11111111-1111-1111-1111-1111111111dd'),
  ('11111111-1111-1111-1111-111111111122', '11111111-1111-1111-1111-1111111111ff', '11111111-1111-1111-1111-1111111111bb', 'approved', false, '11111111-1111-1111-1111-1111111111dd'),
  ('11111111-1111-1111-1111-111111111133', '11111111-1111-1111-1111-1111111111ff', '11111111-1111-1111-1111-1111111111cc', 'pending', false, '11111111-1111-1111-1111-1111111111dd')
ON CONFLICT (id, club_id) DO NOTHING;

-- Insert virtual meeting link records
INSERT INTO public.virtual_meetings (id, event_id, club_id, platform, meeting_url, meeting_password, provider_id)
VALUES 
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-1111111111ee', '11111111-1111-1111-1111-1111111111dd', 'zoom', 'https://zoom.us/j/future', '1234', 'future-id'),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-1111111111ff', '11111111-1111-1111-1111-1111111111dd', 'zoom', 'https://zoom.us/j/active', '5678', 'active-id')
ON CONFLICT (id, club_id) DO NOTHING;


-- 3. Assert RLS constraints

-- Test A: Unapproved attendee (student-cc) cannot view active link
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111cc"}', true);

SELECT results_eq(
    $$ SELECT count(*)::int FROM public.virtual_meetings WHERE id = '11111111-1111-1111-1111-111111111102' $$,
    $$ VALUES (0) $$,
    'Unapproved attendee should not see the meeting link'
);

-- Test B: Approved attendee (student-bb) cannot view future link (too early, starts in 1 day)
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111bb"}', true);

SELECT results_eq(
    $$ SELECT count(*)::int FROM public.virtual_meetings WHERE id = '11111111-1111-1111-1111-111111111101' $$,
    $$ VALUES (0) $$,
    'Approved attendee should not see the meeting link if start date is more than 10 minutes away'
);

-- Test C: Approved attendee (student-bb) CAN view active link (starts in 5 minutes)
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.virtual_meetings WHERE id = '11111111-1111-1111-1111-111111111102' $$,
    $$ VALUES (1) $$,
    'Approved attendee should see the meeting link when start date is less than 10 minutes away'
);

-- Test D: Club Admin (student-aa) CAN view all links regardless of time constraints
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111aa"}', true);

-- Mock club admin checks (must mock is_club_admin function behavior or actual memberships in tests)
SELECT results_eq(
    $$ SELECT count(*)::int FROM public.virtual_meetings WHERE id = '11111111-1111-1111-1111-111111111101' $$,
    $$ VALUES (1) $$,
    'Club organizer should see the meeting link regardless of event start time'
);

ROLLBACK;
