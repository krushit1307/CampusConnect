-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'creator@test.com', 'authenticated', 'authenticated', '{"full_name": "Event Creator"}'),
  ('80000000-0000-0000-0000-000000000002', 'member@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Member"}'),
  ('80000000-0000-0000-0000-000000000003', 'outsider@test.com', 'authenticated', 'authenticated', '{"full_name": "Outsider User"}')
ON CONFLICT (id) DO NOTHING;

-- Create test club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('80000000-0000-0000-0000-000000000004', 'Privacy Test Club', 'privacy-test-club', 'Club for testing private events RLS', '80000000-0000-0000-0000-000000000001');

-- Add approved membership for Member User
INSERT INTO public.club_members (id, club_id, user_id, status)
VALUES ('80000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Create a public event and a private event
INSERT INTO public.events (id, club_id, title, description, event_date, created_by, is_private)
VALUES
  ('80000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000004', 'Public Event', 'Everyone can see this', NOW() + INTERVAL '1 day', '80000000-0000-0000-0000-000000000001', FALSE),
  ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000004', 'Private Event', 'Only members can see this', NOW() + INTERVAL '2 days', '80000000-0000-0000-0000-000000000001', TRUE);

-- ==========================================
-- Test Case 1: Outsider can view public event
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000003', true);

SELECT results_eq(
  $$SELECT title FROM public.events WHERE id = '80000000-0000-0000-0000-000000000010'$$,
  ARRAY['Public Event'],
  'Non-member can view public event'
);

-- ==========================================
-- Test Case 2: Outsider CANNOT view private event
-- ==========================================
SELECT is_empty(
  $$SELECT title FROM public.events WHERE id = '80000000-0000-0000-0000-000000000011'$$,
  'Non-member cannot view private event'
);

RESET role;

-- ==========================================
-- Test Case 3: Approved member CAN view private event
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000002', true);

SELECT results_eq(
  $$SELECT title FROM public.events WHERE id = '80000000-0000-0000-0000-000000000011'$$,
  ARRAY['Private Event'],
  'Approved club member can view private event'
);

RESET role;

-- ==========================================
-- Test Case 4: Event creator CAN view private event
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);

SELECT results_eq(
  $$SELECT title FROM public.events WHERE id = '80000000-0000-0000-0000-000000000011'$$,
  ARRAY['Private Event'],
  'Event creator can view private event'
);

RESET role;

-- Finish tests and rollback
SELECT * FROM finish();
ROLLBACK;
