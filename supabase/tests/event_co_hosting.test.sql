-- ============================================================
-- Test Suite: event_co_hosting.test.sql
-- Description: Tests unified event hosts model, notifications, and RLS.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. Check event_hosts table exists
SELECT has_table('public', 'event_hosts', 'Table public.event_hosts should exist');

-- 2. Check event_hosts column attributes
SELECT has_column('public', 'event_hosts', 'event_id', 'event_hosts has event_id');
SELECT has_column('public', 'event_hosts', 'club_id', 'event_hosts has club_id');
SELECT has_column('public', 'event_hosts', 'is_primary_host', 'event_hosts has is_primary_host');
SELECT has_column('public', 'event_hosts', 'status', 'event_hosts has status');

-- 3. Check club_id has been removed from events
SELECT hasnt_column('public', 'events', 'club_id', 'events table should not have club_id column');

-- 4. Setup mock clubs, profiles, members, events
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('00000000-0000-0000-0000-0000000000aa', 'Primary Host Admin', 'student'),
  ('00000000-0000-0000-0000-0000000000bb', 'Co-Host Admin', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES 
  ('00000000-0000-0000-0000-0000000000cc', 'Primary Club', 'primary-club', '00000000-0000-0000-0000-0000000000aa'),
  ('00000000-0000-0000-0000-0000000000dd', 'Co-Host Club', 'co-host-club', '00000000-0000-0000-0000-0000000000bb')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'admin', 'approved'),
  ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000bb', 'admin', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, created_by)
VALUES ('00000000-0000-0000-0000-000000000100', 'CS & Business Mixer', '00000000-0000-0000-0000-0000000000aa');

-- Primary host link
INSERT INTO public.event_hosts (event_id, club_id, is_primary_host, status)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-0000000000cc', TRUE, 'accepted');

-- 5. Test trigger inserts notification when co-host is invited
INSERT INTO public.event_hosts (event_id, club_id, is_primary_host, status)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-0000000000dd', FALSE, 'pending');

SELECT results_eq(
    $$ SELECT type, title FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-0000000000bb'::uuid $$,
    $$ VALUES ('cohost_invitation'::text, 'Co-Hosting Invitation'::text) $$,
    'Trigger should automatically insert a notification for co-host admins'
);

-- 6. Test is_event_admin returns true for primary host admin and accepted co-host admin (after update)
UPDATE public.event_hosts
SET status = 'accepted'
WHERE event_id = '00000000-0000-0000-0000-000000000100'
  AND club_id = '00000000-0000-0000-0000-0000000000dd';

SELECT is(
    public.is_event_admin('00000000-0000-0000-0000-000000000100'::uuid, '00000000-0000-0000-0000-0000000000aa'::uuid),
    TRUE,
    'is_event_admin should return TRUE for primary host admin'
);

SELECT is(
    public.is_event_admin('00000000-0000-0000-0000-000000000100'::uuid, '00000000-0000-0000-0000-0000000000bb'::uuid),
    TRUE,
    'is_event_admin should return TRUE for accepted co-host admin'
);

SELECT * FROM finish();
ROLLBACK;
