BEGIN;
SELECT plan(10);

-- Setup users, club, event
-- User A
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000001', 'User A');
-- User B
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000002', 'User B');

-- Event
INSERT INTO public.clubs (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000010', 'Club', 'club');
INSERT INTO public.events (id, club_id, title) VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', 'Gala');

-- Layout
INSERT INTO public.seating_layouts (id, event_id) VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000011');
-- Seat
INSERT INTO public.seats (id, layout_id, table_name, seat_number, status) VALUES 
('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000100', 'Table A', '1', 'available'),
('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000100', 'Table A', '2', 'available');

-- Test 1: Lock available seats
SELECT ok(
  public.lock_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001001'::uuid], '00000000-0000-0000-0000-000000000001'),
  'User A locks seat 1'
);

SELECT results_eq(
  $$ SELECT status::text FROM public.seats WHERE id = '00000000-0000-0000-0000-000000001001' $$,
  $$ VALUES ('pending') $$,
  'Seat 1 status is pending'
);

-- Test 2: User B tries to lock the pending seat (should fail)
SELECT throws_ok(
  $$ SELECT public.lock_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001001'::uuid], '00000000-0000-0000-0000-000000000002') $$,
  'P0001',
  'Seat 00000000-0000-0000-0000-000000001001 is temporarily held by another user',
  'User B cannot steal valid pending lock'
);

-- Test 3: Expire lock artificially, then User B tries to lock it
UPDATE public.seats SET lock_expires_at = NOW() - interval '1 minute' WHERE id = '00000000-0000-0000-0000-000000001001';
SELECT ok(
  public.lock_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001001'::uuid], '00000000-0000-0000-0000-000000000002'),
  'User B successfully reclaims expired lock'
);
SELECT results_eq(
  $$ SELECT locked_by FROM public.seats WHERE id = '00000000-0000-0000-0000-000000001001' $$,
  $$ VALUES ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'Seat 1 belongs to User B now'
);

-- Test 4: Confirm purchase
SELECT ok(
  public.confirm_seat_purchase(ARRAY['00000000-0000-0000-0000-000000001001'::uuid], 'order_123'),
  'Confirm purchase'
);
SELECT results_eq(
  $$ SELECT status::text FROM public.seats WHERE id = '00000000-0000-0000-0000-000000001001' $$,
  $$ VALUES ('sold') $$,
  'Seat 1 is sold'
);

-- Test 5: User A tries to lock sold seat
SELECT throws_ok(
  $$ SELECT public.lock_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001001'::uuid], '00000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'Seat 00000000-0000-0000-0000-000000001001 is already sold',
  'Cannot lock sold seat'
);

-- Test 6: Release seats
SELECT ok(
  public.lock_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001002'::uuid], '00000000-0000-0000-0000-000000000001'),
  'User A locks seat 2'
);
SELECT ok(
  public.release_seats('00000000-0000-0000-0000-000000000100', ARRAY['00000000-0000-0000-0000-000000001002'::uuid], '00000000-0000-0000-0000-000000000001'),
  'User A releases seat 2'
);
SELECT results_eq(
  $$ SELECT status::text FROM public.seats WHERE id = '00000000-0000-0000-0000-000000001002' $$,
  $$ VALUES ('available') $$,
  'Seat 2 is available again'
);

SELECT * FROM finish();
ROLLBACK;
