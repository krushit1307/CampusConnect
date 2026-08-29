-- =============================================================================
-- Test: live_chat_moderation_autoban.test.sql
-- Purpose: Verify live chat moderation columns, RPC updates, and RLS rules.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- Test 1: Check new columns on profiles
SELECT has_column('public', 'profiles', 'is_shadowbanned', 'profiles has is_shadowbanned column');
SELECT has_column('public', 'profiles', 'violation_strikes', 'profiles has violation_strikes column');

-- Test 2: Check new column on event_chat_messages
SELECT has_column('public', 'event_chat_messages', 'is_shadowbanned', 'event_chat_messages has is_shadowbanned column');

-- Test 3 & 4: Check default values
SELECT col_default_is('public', 'profiles', 'is_shadowbanned', 'false', 'profiles.is_shadowbanned defaults to false');
SELECT col_default_is('public', 'event_chat_messages', 'is_shadowbanned', 'false', 'event_chat_messages.is_shadowbanned defaults to false');

-- Setup test data
-- Insert a test profile, club, and event
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Test Shadowbanned User', 'student')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET is_shadowbanned = true
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 'Test Club', 'test-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title)
VALUES ('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Test Event')
ON CONFLICT (id) DO NOTHING;

-- Test 5: Verify send_event_chat_message checks shadowbanned status
SELECT is(
  (
    SELECT (send_event_chat_message(
      '00000000-0000-0000-0000-000000000003'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'This is a message from a shadowbanned user'
    )->'data'->>'is_shadowbanned')
  ),
  'true',
  'send_event_chat_message sets is_shadowbanned = true when user is shadowbanned'
);

-- Test 6: Verify RLS select filters out shadowbanned messages from other users
-- Create another user
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000004'::uuid, 'Normal User', 'student')
ON CONFLICT (id) DO NOTHING;

-- Set current user as Normal User
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

SELECT is(
  (
    SELECT count(*)::int
    FROM public.event_chat_messages
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'Normal user cannot see shadowbanned user messages via RLS select'
);

SELECT * FROM finish();
ROLLBACK;
