-- ============================================================
-- Test Suite: weekly_digest_opt_out.test.sql
-- Issue: #2911
-- Description: Verifies get_digest_subscribers() strictly excludes
--              marketing opt-outs (and includes users without a
--              preferences row via COALESCE), and that
--              set_marketing_opt_out() backs the 1-click unsubscribe
--              flow with a per-user token (case-insensitive email).
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (11 tests)
SELECT plan(11);

-- Test 1: get_digest_subscribers exists (zero-arg)
SELECT has_function(
  'public',
  'get_digest_subscribers',
  ARRAY[]::text[],
  'Function get_digest_subscribers() should exist in public schema'
);

-- Test 2: set_marketing_opt_out exists
SELECT has_function(
  'public',
  'set_marketing_opt_out',
  ARRAY['text', 'text'],
  'Function set_marketing_opt_out(text, text) should exist in public schema'
);

-- Setup mock data ----------------------------------------------------------
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'digest@test.com', 'authenticated', 'authenticated', '{"newsletter_opt_in": true}'),
  ('e0000000-0000-0000-0000-000000000002', 'optout@test.com', 'authenticated', 'authenticated', '{"newsletter_opt_in": true}'),
  ('e0000000-0000-0000-0000-000000000003', 'unsub@test.com',  'authenticated', 'authenticated', '{"newsletter_opt_in": true}'),
  ('e0000000-0000-0000-0000-000000000004', 'noprefs@test.com','authenticated', 'authenticated', '{"newsletter_opt_in": true}'),
  ('e0000000-0000-0000-0000-000000000005', 'case@test.com',   'authenticated', 'authenticated', '{"newsletter_opt_in": true}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Digest', 'User', 'student'),
  ('e0000000-0000-0000-0000-000000000002', 'Opt',    'Out',  'student'),
  ('e0000000-0000-0000-0000-000000000003', 'Unsub',  'User', 'student'),
  ('e0000000-0000-0000-0000-000000000004', 'No',     'Prefs','student'),
  ('e0000000-0000-0000-0000-000000000005', 'Case',   'User', 'student')
ON CONFLICT (id) DO NOTHING;

-- user 004 deliberately has NO user_preferences row (exercises COALESCE path)
INSERT INTO public.user_preferences (user_id, receives_marketing_emails, unsubscribe_token)
VALUES
  ('e0000000-0000-0000-0000-000000000001', true,  'tok-1'),
  ('e0000000-0000-0000-0000-000000000002', false, 'tok-2'),
  ('e0000000-0000-0000-0000-000000000003', true,  'tok-3'),
  ('e0000000-0000-0000-0000-000000000005', true,  'tok-4')
ON CONFLICT (user_id) DO NOTHING;

-- Test 3: opted-in user with receives_marketing_emails = true is included
SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'digest@test.com'),
  1,
  'Opted-in user with marketing enabled appears in the digest subscriber list'
);

-- Test 4: opted-in user with receives_marketing_emails = false is excluded
SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'optout@test.com'),
  0,
  'User with receives_marketing_emails = false is strictly filtered out'
);

-- Test 5: wrong token cannot flip the opt-out flag
SELECT is(
  public.set_marketing_opt_out('unsub@test.com', 'wrong-token'),
  false,
  'set_marketing_opt_out rejects a mismatched token'
);

SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'unsub@test.com'),
  1,
  'User is still subscribed after a failed unsubscribe attempt'
);

-- Test 6: correct token flips the opt-out flag
SELECT is(
  public.set_marketing_opt_out('unsub@test.com', 'tok-3'),
  true,
  'set_marketing_opt_out succeeds with the correct token'
);

-- Test 7: unsubscribed user is excluded from the next digest run
SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'unsub@test.com'),
  0,
  'Unsubscribed user is excluded from the digest subscriber list'
);

-- Test 8: opted-in user WITHOUT a user_preferences row is still included
SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'noprefs@test.com'),
  1,
  'Opted-in user without a preferences row defaults to receives_marketing_emails = true'
);

-- Test 9: unsubscribe works with an uppercase email variant (LOWER() lookup)
SELECT is(
  public.set_marketing_opt_out('CASE@TEST.COM', 'tok-4'),
  true,
  'set_marketing_opt_out matches emails case-insensitively'
);

-- Test 10: uppercase-unsubscribed user is excluded from the next digest run
SELECT is(
  (SELECT count(*)::int FROM public.get_digest_subscribers() WHERE email = 'case@test.com'),
  0,
  'Case-variant unsubscribed user is excluded from the digest subscriber list'
);

SELECT * FROM finish();
ROLLBACK;
