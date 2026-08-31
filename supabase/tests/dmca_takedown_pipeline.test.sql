-- =============================================================================
-- Test Suite: dmca_takedown_pipeline.test.sql
-- Purpose: Verify DMCA takedown logs table, status updates, notifications,
--          and quarantine RPC functionality.
-- =============================================================================

BEGIN;

SELECT plan(6);

-- 1. Schema verification
SELECT has_table('public', 'dmca_takedown_logs', 'dmca_takedown_logs table exists');

-- Setup seeds
-- Student profile
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-dm0000000001'::uuid, 'DMCA', 'Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Event
INSERT INTO public.events (id, title)
VALUES ('00000000-0000-0000-0000-dm0000000002'::uuid, 'Summer Party Highlights')
ON CONFLICT (id) DO NOTHING;

-- Event Photo (Status active initially)
INSERT INTO public.event_photos (id, event_id, user_id, url, status)
VALUES (
  '00000000-0000-0000-0000-dm0000000003'::uuid,
  '00000000-0000-0000-0000-dm0000000002'::uuid,
  '00000000-0000-0000-0000-dm0000000001'::uuid,
  'https://s3.amazonaws.com/event-galleries/party.mp4',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test Success Quarantine
SELECT is(
  (SELECT public.quarantine_media_dmca(
    '00000000-0000-0000-0000-dm0000000003'::uuid,
    'Shake It Off',
    'Taylor Swift',
    98.50,
    '{"matched_title": "Shake It Off"}'::jsonb
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'Successful DMCA quarantine executes and returns success'
);

-- Verify status update in public.event_photos
SELECT is(
  (SELECT status FROM public.event_photos WHERE id = '00000000-0000-0000-0000-dm0000000003'::uuid),
  'quarantined',
  'Photo status is successfully updated to quarantined'
);

-- Verify DMCA log insertion
SELECT is(
  (SELECT COUNT(*)::INT FROM public.dmca_takedown_logs 
   WHERE photo_id = '00000000-0000-0000-0000-dm0000000003'::uuid AND song_title = 'Shake It Off'),
  1,
  'Record is successfully created in dmca_takedown_logs'
);

-- Verify Student Notification is sent
SELECT is(
  (SELECT COUNT(*)::INT FROM public.notifications 
   WHERE user_id = '00000000-0000-0000-0000-dm0000000001'::uuid AND type = 'security'),
  1,
  'Warning security notification is successfully sent to the student'
);

-- 3. Test Failure: quarantine_media_dmca with invalid ID
SELECT is(
  (SELECT public.quarantine_media_dmca(
    '00000000-0000-0000-0000-ffffffffffff'::uuid,
    'NonExistent',
    'Artist',
    50.00,
    '{}'::jsonb
  ) ->> 'success')::BOOLEAN,
  FALSE,
  'Quarantine fails for non-existent photo ID'
);

ROLLBACK;
