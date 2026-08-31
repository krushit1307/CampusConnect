-- supabase/tests/federation.test.sql
-- pgTAP tests for Dynamic "Multi-Campus" Federation Protocol

BEGIN;
SELECT plan(8);

-- 1. Check tables exist
SELECT has_table('remote_events', 'remote_events table must exist');
SELECT has_table('federated_servers', 'federated_servers table must exist');
SELECT has_table('remote_event_rsvps', 'remote_event_rsvps table must exist');

-- 2. Check columns in remote_event_rsvps
SELECT has_column('remote_event_rsvps', 'id', 'remote_event_rsvps has id column');
SELECT has_column('remote_event_rsvps', 'remote_event_id', 'remote_event_rsvps has remote_event_id column');
SELECT has_column('remote_event_rsvps', 'user_id', 'remote_event_rsvps has user_id column');

-- 3. Setup test data
INSERT INTO public.federated_servers (domain, api_key_hash, institution_name, is_active)
VALUES ('peer-campus.edu', 'mock-api-key-hash', 'Peer University', true);

INSERT INTO public.remote_events (id, origin_server_domain, origin_event_id, title, start_time, host_institution)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'peer-campus.edu', 'original-event-123', 'Federated Guest Event', now(), 'Peer University');

-- Verify test insertion succeeded
SELECT results_eq(
    $$ SELECT origin_server_domain, host_institution FROM public.remote_events WHERE id = '00000000-0000-0000-0000-000000000001'::uuid $$,
    $$ VALUES ('peer-campus.edu'::text, 'Peer University'::text) $$,
    'remote_event should be inserted successfully'
);

-- Verify foreign key relation constraint or setup shadow profiles manually
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 'external-student@peer-campus.edu', 'External Student Name', 'student');

INSERT INTO public.remote_event_rsvps (remote_event_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid);

SELECT results_eq(
    $$ SELECT count(*)::integer FROM public.remote_event_rsvps WHERE remote_event_id = '00000000-0000-0000-0000-000000000001'::uuid $$,
    $$ VALUES (1::integer) $$,
    'remote_event_rsvp should be recorded successfully for shadow profile'
);

SELECT * FROM finish();
ROLLBACK;
