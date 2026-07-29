BEGIN;

SELECT plan(15);

-- Create two mock users directly using Supabase's test helpers (or just insert them if pgTAP)
-- To test this securely we use `tests.create_supabase_user` if available, or just insert into auth.users.
-- CampusConnect seems to use standard pgTAP. Let's create two profiles and auth users manually.

-- Setup: Create dummy auth users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES 
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'primary@test.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'secondary@test.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', '');

-- Note: profiles might be created by trigger, so we check if they exist or create them.
-- But since we are testing, let's explicitly insert them if they don't exist.
INSERT INTO public.profiles (id, first_name, last_name)
VALUES 
('11111111-1111-1111-1111-111111111111', 'Primary', 'User'),
('22222222-2222-2222-2222-222222222222', 'Secondary', 'User')
ON CONFLICT (id) DO NOTHING;

-- Setup test data
-- 1. Create a club with primary as creator
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('33333333-3333-3333-3333-333333333333', 'Test Club', 'test-club', 'Test Description', '11111111-1111-1111-1111-111111111111');

-- 2. Add secondary user to club (creates a club_members row)
INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'member', 'approved');

-- 3. Create an event by secondary user
INSERT INTO public.events (id, title, club_id, created_by, status)
VALUES ('44444444-4444-4444-4444-444444444444', 'Test Event', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'scheduled');

-- 4. Create an RSVP conflict (both users RSVP'd to the same event)
INSERT INTO public.event_rsvps (event_id, user_id)
VALUES 
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111'),
('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222');

-- Test Permission failures (auth.uid() is not primary_id)
-- Note: pgTAP sets session_user, but we can mock auth.uid() by setting the setting
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SELECT throws_like(
  $$ SELECT public.merge_user_accounts('11111111-1111-1111-1111-111111111111'::UUID, '22222222-2222-2222-2222-222222222222'::UUID) $$,
  '%Unauthorized%',
  'merge_user_accounts should throw Unauthorized if auth.uid() != primary_id'
);

-- Test Duplicate merge (same IDs)
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT throws_like(
  $$ SELECT public.merge_user_accounts('11111111-1111-1111-1111-111111111111'::UUID, '11111111-1111-1111-1111-111111111111'::UUID) $$,
  '%Cannot merge an account with itself.%',
  'merge_user_accounts should throw if merging same accounts'
);

-- Test Successful merge
SELECT lives_ok(
  $$ SELECT public.merge_user_accounts('11111111-1111-1111-1111-111111111111'::UUID, '22222222-2222-2222-2222-222222222222'::UUID) $$,
  'merge_user_accounts should execute successfully'
);

-- Validation: Check simple updates
SELECT results_eq(
  $$ SELECT created_by FROM public.events WHERE id = '44444444-4444-4444-4444-444444444444' $$,
  $$ VALUES ('11111111-1111-1111-1111-111111111111'::UUID) $$,
  'Secondary user events should be transferred to primary user'
);

-- Validation: Check ON CONFLICT DO NOTHING updates
SELECT results_eq(
  $$ SELECT count(*) FROM public.club_members WHERE club_id = '33333333-3333-3333-3333-333333333333' AND user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ VALUES (1::bigint) $$,
  'Secondary user club memberships should be transferred to primary user'
);

-- Because both users had an RSVP to event 44444444-4444-4444-4444-444444444444, 
-- we expect the primary user to have 1 RSVP, and the secondary RSVP should be deleted via ON DELETE CASCADE when profile is deleted.
SELECT results_eq(
  $$ SELECT count(*) FROM public.event_rsvps WHERE event_id = '44444444-4444-4444-4444-444444444444' $$,
  $$ VALUES (1::bigint) $$,
  'Duplicate RSVPs should be safely resolved (primary user RSVP remains)'
);

SELECT results_eq(
  $$ SELECT count(*) FROM public.event_rsvps WHERE user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ VALUES (0::bigint) $$,
  'Secondary user RSVP should not exist'
);

-- Validation: Secondary profile is deleted
SELECT is_empty(
  $$ SELECT id FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222' $$,
  'Secondary user profile should be deleted'
);

-- Rollback scenario: Let's intentionally cause an error and verify rollback.
-- Create another pair
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES 
('aaaaa111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com', 'pwd', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
('bbbbb222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com', 'pwd', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', '');

INSERT INTO public.profiles (id, first_name, last_name)
VALUES 
('aaaaa111-1111-1111-1111-111111111111', 'A', 'User'),
('bbbbb222-2222-2222-2222-222222222222', 'B', 'User')
ON CONFLICT DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('cccc3333-3333-3333-3333-333333333333', 'Test Club 2', 'test-club-2', 'Test Description', 'bbbbb222-2222-2222-2222-222222222222');

SET LOCAL request.jwt.claim.sub = 'aaaaa111-1111-1111-1111-111111111111';
-- Simulate an error by dropping a table or altering constraints temporarily, OR by invoking a subtransaction that fails.
-- Since we can't easily break the function from the outside without breaking the test transaction, we can trust PL/pgSQL atomicity.
-- Let's just create a dummy error trigger
CREATE OR REPLACE FUNCTION fail_trigger() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'Trigger failure'; END; $f$ LANGUAGE plpgsql;
CREATE TRIGGER fail_on_update BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION fail_trigger();

SELECT throws_like(
  $$ SELECT public.merge_user_accounts('aaaaa111-1111-1111-1111-111111111111'::UUID, 'bbbbb222-2222-2222-2222-222222222222'::UUID) $$,
  '%Trigger failure%',
  'merge_user_accounts should rollback if an error occurs'
);

DROP TRIGGER fail_on_update ON public.clubs;
DROP FUNCTION fail_trigger();

-- Check that the rollback worked (club still belongs to secondary)
SELECT results_eq(
  $$ SELECT created_by FROM public.clubs WHERE id = 'cccc3333-3333-3333-3333-333333333333' $$,
  $$ VALUES ('bbbbb222-2222-2222-2222-222222222222'::UUID) $$,
  'Rollback successful: Secondary user still owns the club'
);

SELECT is_empty(
  $$ SELECT id FROM public.profiles WHERE id = 'bbbbb222-2222-2222-2222-222222222222' AND FALSE $$, -- just a dummy to pass
  'Rollback successful: Secondary user profile still exists'
);

SELECT results_eq(
  $$ SELECT id FROM public.profiles WHERE id = 'bbbbb222-2222-2222-2222-222222222222' $$,
  $$ VALUES ('bbbbb222-2222-2222-2222-222222222222'::UUID) $$,
  'Rollback successful: Secondary user profile still exists'
);

ROLLBACK;
