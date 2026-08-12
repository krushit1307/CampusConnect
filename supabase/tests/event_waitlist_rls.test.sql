BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'user_a@test.com', 'authenticated', 'authenticated', '{"full_name": "User A"}'),
  ('e0000000-0000-0000-0000-000000000002', 'user_b@test.com', 'authenticated', 'authenticated', '{"full_name": "User B"}'),
  ('e0000000-0000-0000-0000-000000000003', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Admin"}'),
  ('e0000000-0000-0000-0000-000000000004', 'sys_admin@test.com', 'authenticated', 'authenticated', '{"full_name": "System Admin"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'student' WHERE id IN ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
UPDATE public.profiles SET role = 'club_admin' WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET role = 'system_admin' WHERE id = 'e0000000-0000-0000-0000-000000000004';

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('e0000000-0000-0000-0000-000000000005', 'RLS Test Club', 'rls-test-club', 'Club for testing waitlist RLS', 'e0000000-0000-0000-0000-000000000003');

INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date, max_attendees)
VALUES (
  'e0000000-0000-0000-0000-000000000006',
  'e0000000-0000-0000-0000-000000000005',
  'RLS Test Event',
  'Event for testing waitlist RLS',
  'Room 101',
  'e0000000-0000-0000-0000-000000000003',
  'scheduled',
  NOW() + INTERVAL '3 days',
  0
);

-- Test 1: User A can insert their own waitlist entry
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
INSERT INTO public.event_waitlist (event_id, user_id)
VALUES ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001');
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001'),
  'User A can insert their own waitlist entry'
);

-- Test 2: User A can see their own waitlist entry
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001'),
  'User A can read their own waitlist entry'
);

-- Test 3: User B cannot see User A's waitlist entry
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001'),
  'User B cannot read User A''s waitlist entry'
);

-- Test 4: User B cannot insert a waitlist entry for User A
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$INSERT INTO public.event_waitlist (event_id, user_id)
    VALUES ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001')$$,
  '42501',
  NULL,
  'User B cannot insert waitlist entry for User A'
);

-- Test 5: User A can delete their own waitlist entry
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
DELETE FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001'),
  'User A can delete their own waitlist entry'
);

-- Re-insert for next tests
INSERT INTO public.event_waitlist (event_id, user_id)
VALUES ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001');

-- Test 6: User B cannot delete User A's waitlist entry
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
SELECT throws_ok(
  $$DELETE FROM public.event_waitlist WHERE user_id = 'e0000000-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'User B cannot delete User A''s waitlist entry'
);

-- Test 7: Club admin can see all waitlist entries for their event
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000003', true);
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_waitlist WHERE event_id = 'e0000000-0000-0000-0000-000000000006'),
  'Club admin can read all waitlist entries for their event'
);

-- Test 8: System admin can update waitlist entries
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000004', true);
SELECT lives_ok(
  $$UPDATE public.event_waitlist SET created_at = NOW() WHERE user_id = 'e0000000-0000-0000-0000-000000000001'$$,
  'System admin can update waitlist entries'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
