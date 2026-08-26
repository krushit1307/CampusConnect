-- pgTAP Test: get_yearly_summary
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- Test 1: Verify get_yearly_summary function exists with correct signature
SELECT has_function(
  'public',
  'get_yearly_summary',
  ARRAY['uuid', 'integer'],
  'Function get_yearly_summary(UUID, INT) should exist'
);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with test insertion
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- 1. Create a test user in auth.users (triggers profile creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('80000000-0000-0000-0000-000000000001', 'summarytest@test.com', 'authenticated', 'authenticated', '{"full_name": "Test User"}')
ON CONFLICT (id) DO NOTHING;

-- Set correct role
UPDATE public.profiles SET role = 'student' WHERE id = '80000000-0000-0000-0000-000000000001';

-- 2. Create clubs
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES 
  ('80000000-0000-0000-0000-000000000002', 'Club Alpha', 'club-alpha', 'Testing alpha', '80000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000003', 'Club Beta', 'club-beta', 'Testing beta', '80000000-0000-0000-0000-000000000001');

-- 3. Create events
INSERT INTO public.events (id, club_id, title, description, event_date, status, created_by)
VALUES 
  ('80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'Event A1', 'Club Alpha Event 1', '2026-05-15 10:00:00+00', 'scheduled', '80000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000002', 'Event A2', 'Club Alpha Event 2', '2026-06-20 12:00:00+00', 'scheduled', '80000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000003', 'Event B1', 'Club Beta Event 1', '2026-06-10 11:00:00+00', 'scheduled', '80000000-0000-0000-0000-000000000001');

-- 4. Create RSVPs
-- RSVP 1: Checked in (Club Alpha) in May 2026
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in, rsvp_at)
VALUES ('80000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', TRUE, '2026-05-15 10:00:00+00');

-- RSVP 2: Checked in (Club Alpha) in June 2026
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in, rsvp_at)
VALUES ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000001', TRUE, '2026-06-20 12:00:00+00');

-- RSVP 3: Not checked in (Club Beta) in June 2026
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in, rsvp_at)
VALUES ('80000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000001', FALSE, '2026-06-10 11:00:00+00');

-- 5. Create Posts and Comments
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('80000000-0000-0000-0000-000000000020', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'Test Post');

-- Comment 1: June 2026
INSERT INTO public.comments (id, post_id, author_id, content, created_at)
VALUES ('80000000-0000-0000-0000-000000000030', '80000000-0000-0000-0000-000000000020', '80000000-0000-0000-0000-000000000001', 'Comment 1', '2026-06-05 14:00:00+00');

-- Comment 2: July 2026
INSERT INTO public.comments (id, post_id, author_id, content, created_at)
VALUES ('80000000-0000-0000-0000-000000000031', '80000000-0000-0000-0000-000000000020', '80000000-0000-0000-0000-000000000001', 'Comment 2', '2026-07-02 09:00:00+00');

-- Get the function output
DECLARE
  v_summary JSON;
BEGIN
  v_summary := public.get_yearly_summary('80000000-0000-0000-0000-000000000001', 2026);

  -- Test 2: Check total_events_attended is 2
  SELECT is(
    (v_summary->>'total_events_attended')::INT,
    2,
    'total_events_attended should be 2'
  );

  -- Test 3: Check most_visited_club is 'Club Alpha'
  SELECT is(
    v_summary->>'most_visited_club',
    'Club Alpha',
    'most_visited_club should be Club Alpha'
  );

  -- Test 4: Check total_comments_posted is 2
  SELECT is(
    (v_summary->>'total_comments_posted')::INT,
    2,
    'total_comments_posted should be 2'
  );

  -- Test 5: Check busiest_month is 'June'
  -- May: 1 event check-in
  -- June: 1 event check-in, 1 comment (Total 2)
  -- July: 1 comment
  SELECT is(
    v_summary->>'busiest_month',
    'June',
    'busiest_month should be June'
  );
END;

-- Test 6: Verify output for a year with no activity (e.g. 2025)
SELECT is(
  public.get_yearly_summary('80000000-0000-0000-0000-000000000001', 2025)::TEXT,
  json_build_object(
    'total_events_attended', 0,
    'most_visited_club', NULL,
    'total_comments_posted', 0,
    'busiest_month', NULL
  )::TEXT,
  'Summary for a year with no activity should return default/null values'
);

SELECT * FROM finish();
ROLLBACK;
