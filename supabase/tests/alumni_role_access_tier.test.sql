-- ============================================================
-- Test Suite: alumni_role_access_tier.test.sql
-- Description: Verifies schema, triggers, and restrictions for the Alumni role.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(15);

-- 1. Verify schema elements exist
SELECT has_column('public', 'profiles', 'alumni_transitioned_at', 'profiles should have alumni_transitioned_at column');
SELECT has_column('public', 'events', 'allow_alumni', 'events should have allow_alumni column');
SELECT has_column('public', 'bulk_email_jobs', 'target_audience', 'bulk_email_jobs should have target_audience column');

-- 2. Verify function existence and parameters
SELECT has_function(
    'public',
    'get_club_member_emails',
    ARRAY['uuid', 'text'],
    'Function get_club_member_emails(uuid, text) should exist'
);

-- 3. Setup mock data
-- Create users
INSERT INTO public.profiles (id, full_name, role, alumni_transitioned_at)
VALUES 
  ('00000000-0000-0000-0000-00000000000a', 'Student User', 'student', NULL),
  ('00000000-0000-0000-0000-00000000000b', 'Expired Alumni', 'alumni', NOW() - INTERVAL '4 months'),
  ('00000000-0000-0000-0000-00000000000c', 'Grace Period Alumni', 'alumni', NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- Create club
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-00000000000d', 'Alumni Devs Club', 'alumni-devs')
ON CONFLICT (id) DO NOTHING;

-- Create events
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, event_date, allow_alumni)
VALUES 
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000d', 'Student Only Hack', 100, 100, NOW() + INTERVAL '5 days', false),
  ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000d', 'Alumni Homecoming Meet', 100, 100, NOW() + INTERVAL '10 days', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Test RSVP behavior
-- Student user RSVPs to student only event (succeeds)
SELECT lives_ok(
    $$ INSERT INTO public.event_rsvps (id, event_id, user_id, status) VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a', 'attending') $$,
    'Student user should successfully RSVP to student-only event'
);

-- Grace period alumni RSVPs to student only event (succeeds due to 3-month grace period)
SELECT lives_ok(
    $$ INSERT INTO public.event_rsvps (id, event_id, user_id, status) VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000c', 'attending') $$,
    'Grace period alumni should successfully RSVP to student-only event'
);

-- Expired alumni RSVPs to student only event (fails)
SELECT throws_ok(
    $$ INSERT INTO public.event_rsvps (id, event_id, user_id, status) VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000b', 'attending') $$,
    'P0001',
    'Alumni are not allowed to RSVP to student-only events.',
    'Expired alumni should be blocked from RSVPing to student-only events'
);

-- Expired alumni RSVPs to alumni allowed event (succeeds)
SELECT lives_ok(
    $$ INSERT INTO public.event_rsvps (id, event_id, user_id, status) VALUES ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000b', 'attending') $$,
    'Expired alumni should successfully RSVP to alumni-allowed event'
);

-- 5. Test Club Admin restrictions
-- Student user joins as admin (succeeds)
SELECT lives_ok(
    $$ INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a', 'admin', 'approved') $$,
    'Student user should successfully join as club admin'
);

-- Grace period alumni joins as admin (succeeds)
SELECT lives_ok(
    $$ INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c', 'admin', 'approved') $$,
    'Grace period alumni should successfully join as club admin'
);

-- Expired alumni joins as admin (fails)
SELECT throws_ok(
    $$ INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', 'admin', 'approved') $$,
    'P0001',
    'Alumni whose grace period has expired cannot hold club admin permissions.',
    'Expired alumni should be blocked from becoming club admin'
);

-- Expired alumni joins as normal member (succeeds)
SELECT lives_ok(
    $$ INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000b', 'member', 'approved') $$,
    'Expired alumni should successfully join as regular member'
);

-- 6. Test Daily Cleanup Cron Function
-- Run cleanup
SELECT lives_ok(
    $$ SELECT public.cleanup_expired_alumni_permissions() $$,
    'Executing cleanup_expired_alumni_permissions should succeed'
);

-- Verify grace period alumni remains admin
SELECT results_eq(
    $$ SELECT role FROM public.club_members WHERE user_id = '00000000-0000-0000-0000-00000000000c' $$,
    $$ VALUES ('admin'::public.member_role) $$,
    'Grace period alumni should remain club admin after cleanup execution'
);

-- Change grace period alumni transition date to 4 months ago (expire them)
UPDATE public.profiles
SET alumni_transitioned_at = NOW() - INTERVAL '4 months'
WHERE id = '00000000-0000-0000-0000-00000000000c';

-- Run cleanup again
SELECT lives_ok(
    $$ SELECT public.cleanup_expired_alumni_permissions() $$,
    'Executing cleanup_expired_alumni_permissions a second time should succeed'
);

-- Verify newly expired alumni is demoted to member
SELECT results_eq(
    $$ SELECT role FROM public.club_members WHERE user_id = '00000000-0000-0000-0000-00000000000c' $$,
    $$ VALUES ('member'::public.member_role) $$,
    'Newly expired alumni should be demoted to member by cleanup execution'
);

SELECT * FROM finish();
ROLLBACK;
