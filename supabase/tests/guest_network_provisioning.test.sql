BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);

-- 1. Check Tables and Columns
SELECT has_table('public', 'guest_network_credentials', 'guest_network_credentials table should exist');
SELECT has_column('public', 'guest_network_credentials', 'rsvp_id', 'guest_network_credentials should have rsvp_id');
SELECT has_column('public', 'guest_network_credentials', 'username', 'guest_network_credentials should have username');
SELECT has_column('public', 'guest_network_credentials', 'password', 'guest_network_credentials should have password');
SELECT has_column('public', 'guest_network_credentials', 'essid', 'guest_network_credentials should have essid');
SELECT has_column('public', 'guest_network_credentials', 'expires_at', 'guest_network_credentials should have expires_at');

-- 2. Test RLS Security Policy
-- Setup test users
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'user1@test.edu', 'authenticated', 'authenticated'),
  ('80000000-0000-0000-0000-000000000002', 'user2@test.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, college, email)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'User One', 'Harvard', 'user1@test.edu'),
  ('80000000-0000-0000-0000-000000000002', 'User Two', 'MIT', 'user2@test.edu')
ON CONFLICT (id) DO NOTHING;

-- Setup test event
INSERT INTO public.events (id, title, description, start_date, end_date, max_attendees, created_by)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'MIT Hackathon', 'Coding...', NOW(), NOW() + INTERVAL '1 day', 100, '80000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Setup RSVPs
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in)
VALUES
  ('70000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', true),
  ('70000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO NOTHING;

-- Insert Guest Credentials for User One
INSERT INTO public.guest_network_credentials (rsvp_id, username, password, essid, expires_at)
VALUES ('70000000-0000-0000-0000-000000000001', 'mit_guest_user1', 'PASS123', 'MIT-Guest', NOW() + INTERVAL '12 hours');

-- Test SELECT: Owner can select their own credentials
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT username FROM public.guest_network_credentials WHERE rsvp_id = '70000000-0000-0000-0000-000000000001'),
  'mit_guest_user1',
  'Owner user can select their own guest credentials'
);

-- Test SELECT: Non-owner cannot select another user's credentials
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '80000000-0000-0000-0000-000000000002';

SELECT is_empty(
  'SELECT username FROM public.guest_network_credentials WHERE rsvp_id = ''70000000-0000-0000-0000-000000000001''',
  'Non-owner user cannot view another user''s guest network credentials'
);

RESET ROLE;

ROLLBACK;
