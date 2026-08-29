-- Tests for photo_upload_tokens table

BEGIN;

SELECT plan(7);

-- Create mock user
SELECT tests.create_supabase_user('organizer123', 'organizer@test.com');
SELECT tests.create_supabase_user('random456', 'random@test.com');

-- Create mock club and event
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Club', 'test-club', 'organizer123');

INSERT INTO public.events (id, club_id, title, created_by, start_date, end_date)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Past Event', 'organizer123', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days');

-- Authenticate as service_role
SELECT tests.authenticate_as('service_role');

-- Service role can insert token
SELECT lives_ok(
  $$ INSERT INTO public.photo_upload_tokens (token, event_id, organizer_id, expires_at) VALUES ('secret-token', '00000000-0000-0000-0000-000000000002', 'organizer123', NOW() + INTERVAL '7 days') $$,
  'Service role can insert photo_upload_tokens'
);

-- Service role can read token
SELECT results_eq(
  $$ SELECT token FROM public.photo_upload_tokens WHERE event_id = '00000000-0000-0000-0000-000000000002' $$,
  $$ VALUES ('secret-token') $$,
  'Service role can read token'
);

-- Service role can update token
SELECT lives_ok(
  $$ UPDATE public.photo_upload_tokens SET used_at = NOW() WHERE token = 'secret-token' $$,
  'Service role can update token'
);

SELECT tests.clear_authentication();

-- Authenticate as organizer
SELECT tests.authenticate_as('organizer123');

-- Organizer can read their token
SELECT results_eq(
  $$ SELECT token FROM public.photo_upload_tokens WHERE token = 'secret-token' $$,
  $$ VALUES ('secret-token') $$,
  'Organizer can read their own token'
);

-- Organizer cannot insert token
SELECT throws_ok(
  $$ INSERT INTO public.photo_upload_tokens (token, event_id, organizer_id, expires_at) VALUES ('fake-token', '00000000-0000-0000-0000-000000000002', 'organizer123', NOW() + INTERVAL '7 days') $$,
  'new row violates row-level security policy for table "photo_upload_tokens"',
  'Organizer cannot insert token'
);

SELECT tests.clear_authentication();

-- Authenticate as random user
SELECT tests.authenticate_as('random456');

-- Random user cannot read organizer's token
SELECT is_empty(
  $$ SELECT token FROM public.photo_upload_tokens WHERE token = 'secret-token' $$,
  'Random user cannot read other organizers token'
);

-- Anonymous user cannot read token
SELECT tests.clear_authentication();
SELECT is_empty(
  $$ SELECT token FROM public.photo_upload_tokens WHERE token = 'secret-token' $$,
  'Anonymous user cannot read tokens'
);

SELECT * FROM finish();
ROLLBACK;
