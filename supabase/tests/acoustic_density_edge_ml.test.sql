-- =============================================================================
-- Test Suite: acoustic_density_edge_ml.test.sql
-- Purpose: Verify Edge ML acoustic microphones, telemetry logs, privacy scores,
--          overcrowding alerts, and security notifications.
-- =============================================================================

BEGIN;

SELECT plan(8);

-- 1. Schema checks
SELECT has_table('public', 'acoustic_microphones', 'acoustic_microphones table exists');
SELECT has_table('public', 'acoustic_density_telemetry', 'acoustic_density_telemetry table exists');
SELECT has_table('public', 'acoustic_overcrowding_alerts', 'acoustic_overcrowding_alerts table exists');

-- Setup seeds
-- Admin profile
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('00000000-0000-0000-0000-ac0000000001'::uuid, 'Acoustic', 'Admin', 'system_admin')
ON CONFLICT (id) DO NOTHING;

-- Venue
INSERT INTO public.venues (id, name, building, capacity)
VALUES ('00000000-0000-0000-0000-ac0000000002'::uuid, 'Study Room A', 'Science Library', 15)
ON CONFLICT (id) DO NOTHING;

-- Microphone Device
INSERT INTO public.acoustic_microphones (id, venue_id, room_number, firmware_version, is_model_flashed)
VALUES (
  '00000000-0000-0000-0000-ac0000000003'::uuid,
  '00000000-0000-0000-0000-ac0000000002'::uuid,
  'Room 101',
  'v1.0.0-tflite',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ingest Safe Density Reading (50% < 85% threshold)
SELECT is(
  (SELECT public.ingest_acoustic_density(
    '00000000-0000-0000-0000-ac0000000003'::uuid,
    50,
    'campus/science/mic-1/density'
  ) ->> 'success')::BOOLEAN,
  TRUE,
  'Successful ingestion of safe density score returns success'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.acoustic_density_telemetry 
   WHERE microphone_id = '00000000-0000-0000-0000-ac0000000003'::uuid),
  1,
  'Telemetry record is successfully stored'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.acoustic_overcrowding_alerts),
  0,
  'No alert is triggered for safe density reading'
);

-- 3. Ingest High Density Reading (90% >= 85% threshold) -> triggers alert & notify admin
SELECT is(
  (SELECT public.ingest_acoustic_density(
    '00000000-0000-0000-0000-ac0000000003'::uuid,
    90,
    'campus/science/mic-1/density'
  ) ->> 'alert_triggered')::BOOLEAN,
  TRUE,
  'Ingesting a high density score triggers overcrowding alert'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.notifications 
   WHERE user_id = '00000000-0000-0000-0000-ac0000000001'::uuid AND type = 'security_alert'),
  1,
  'Security notification is sent to the system administrator'
);

ROLLBACK;
