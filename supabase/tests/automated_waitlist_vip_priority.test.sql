-- ============================================================
-- Test Suite: automated_waitlist_vip_priority.test.sql
-- Description: Verifies VIP Priority waitlist promotion and positioning.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check user_role enum has 'Premium'
SELECT has_type('public', 'user_role', 'user_role type should exist');
SELECT is(
    (SELECT count(*)::int FROM pg_enum WHERE enumtypid = 'public.user_role'::regtype AND enumlabel = 'Premium'),
    1,
    'Premium role should exist in user_role enum'
);

-- 2. Mock setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES 
    ('44444444-4444-4444-4444-444444444401', 'Free', 'One', 'student'),
    ('44444444-4444-4444-4444-444444444402', 'Premium', 'Two', 'Premium'),
    ('44444444-4444-4444-4444-444444444403', 'Premium', 'Three', 'Premium'),
    ('44444444-4444-4444-4444-444444444404', 'Free', 'Four', 'student'),
    ('44444444-4444-4444-4444-444444444405', 'Spot', 'Holder', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('44444444-4444-4444-4444-4444444444aa', 'VIP Test Club', 'vip-test-club')
ON CONFLICT (id) DO NOTHING;

-- Event (1 capacity)
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status)
VALUES (
    '44444444-4444-4444-4444-4444444444bb', 
    '44444444-4444-4444-4444-4444444444aa', 
    'VIP Gala', 
    1, 
    1, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    'published'
)
ON CONFLICT (id) DO NOTHING;

-- Spot Holder takes the only ticket spot
INSERT INTO public.event_rsvps (event_id, user_id)
VALUES ('44444444-4444-4444-4444-4444444444bb', '44444444-4444-4444-4444-444444444405');

-- Free User 1 joins waitlist 3 hours ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('44444444-4444-4444-4444-4444444444bb', '44444444-4444-4444-4444-444444444401', NOW() - INTERVAL '3 hours');

-- Premium User 2 joins waitlist 2 hours ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('44444444-4444-4444-4444-4444444444bb', '44444444-4444-4444-4444-444444444402', NOW() - INTERVAL '2 hours');

-- Premium User 3 joins waitlist 1 hour ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('44444444-4444-4444-4444-4444444444bb', '44444444-4444-4444-4444-444444444403', NOW() - INTERVAL '1 hour');

-- Free User 4 joins waitlist 30 minutes ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('44444444-4444-4444-4444-4444444444bb', '44444444-4444-4444-4444-444444444404', NOW() - INTERVAL '30 minutes');

-- 3. Verify get_waitlist_position positions
-- Under VIP rules:
-- Premium User 2 (2 hours ago) should be position 1.
-- Premium User 3 (1 hour ago) should be position 2.
-- Free User 1 (3 hours ago) should be position 3.
-- Free User 4 (30 mins ago) should be position 4.

SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444402"}', true);
SELECT is(
    (SELECT (public.get_waitlist_position('44444444-4444-4444-4444-4444444444bb'))->>'position')::int,
    1,
    'Premium User 2 (joined 2h ago) should be at waitlist position 1'
);

SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444403"}', true);
SELECT is(
    (SELECT (public.get_waitlist_position('44444444-4444-4444-4444-4444444444bb'))->>'position')::int,
    2,
    'Premium User 3 (joined 1h ago) should be at waitlist position 2'
);

SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444401"}', true);
SELECT is(
    (SELECT (public.get_waitlist_position('44444444-4444-4444-4444-4444444444bb'))->>'position')::int,
    3,
    'Free User 1 (joined 3h ago) should be at waitlist position 3'
);

-- 4. Cancel Spot Holder's RSVP (triggers automatic trigger promotion)
DELETE FROM public.event_rsvps 
WHERE event_id = '44444444-4444-4444-4444-4444444444bb' 
  AND user_id = '44444444-4444-4444-4444-444444444405';

-- Assert Premium User 2 is promoted first (oldest Premium)
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE event_id = '44444444-4444-4444-4444-4444444444bb' $$,
    $$ VALUES ('44444444-4444-4444-4444-444444444402'::uuid) $$,
    'Premium User 2 should be promoted first over older Free User 1'
);

ROLLBACK;
