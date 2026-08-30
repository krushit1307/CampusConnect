-- =============================================================================
-- Test Suite: thermal_overcrowding.test.sql
-- Purpose: Verify dynamic thermal overcrowding detection calculations,
--          rolling 20-minute baseline lookbacks, and alert dispatches.
-- =============================================================================

BEGIN;

SELECT plan(9);

-- 1. Schema structure checks
SELECT has_table('public', 'thermostat_telemetry', 'thermostat_telemetry table exists');
SELECT has_column('public', 'thermostat_telemetry', 'temperature_fahrenheit', 'thermostat_telemetry has temperature');
SELECT has_table('public', 'thermal_alerts', 'thermal_alerts table exists');

-- Setup test data
-- Admin profile
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-th0000000001'::uuid, 'Thermal Admin', 'system_admin')
ON CONFLICT (id) DO NOTHING;

-- Venue
INSERT INTO public.venues (id, name, building, capacity)
VALUES ('00000000-0000-0000-0000-th0000000002'::uuid, 'Science Lab 101', 'Science Building', 50)
ON CONFLICT (id) DO NOTHING;

-- 2. First ingestion -> Delta T should be 0, no alert
SELECT is(
  (public.ingest_thermostat_reading(
    '00000000-0000-0000-0000-th0000000002'::uuid,
    70.0,
    NOW()
  ) ->> 'alert_triggered')::BOOLEAN,
  FALSE,
  'First ingestion does not trigger thermal alerts'
);

-- 3. Ingest small increase (5 minutes later, 73 degrees) -> Delta T = 3.0, no alert
SELECT is(
  (public.ingest_thermostat_reading(
    '00000000-0000-0000-0000-th0000000002'::uuid,
    73.0,
    NOW() + INTERVAL '5 minutes'
  ) ->> 'delta_t')::NUMERIC,
  3.0,
  'Delta T tracks minor temperature changes correctly'
);

-- 4. Ingest large anomalous spike (15 minutes later, 82 degrees) -> Delta T = 12.0 (compared to baseline 70), triggers alert!
SELECT is(
  (public.ingest_thermostat_reading(
    '00000000-0000-0000-0000-th0000000002'::uuid,
    82.0,
    NOW() + INTERVAL '15 minutes'
  ) ->> 'alert_triggered')::BOOLEAN,
  TRUE,
  'Ingesting a 12 degree spike triggers a thermal alert'
);

-- 5. Verify alert row creation
SELECT is(
  (SELECT COUNT(*)::INT FROM public.thermal_alerts 
   WHERE venue_id = '00000000-0000-0000-0000-th0000000002'::uuid AND status = 'TRIGGERED'),
  1,
  'Correctly inserts a record into thermal_alerts'
);

-- 6. Verify security notification sent to admins
SELECT is(
  (SELECT COUNT(*)::INT FROM public.notifications 
   WHERE user_id = '00000000-0000-0000-0000-th0000000001'::uuid AND type = 'security_alert'),
  1,
  'Dispatches emergency notification to system admins'
);

-- 7. Ingest another spike while alert is active -> should NOT duplicate alert row
SELECT is(
  (public.ingest_thermostat_reading(
    '00000000-0000-0000-0000-th0000000002'::uuid,
    85.0,
    NOW() + INTERVAL '18 minutes'
  ) ->> 'alert_triggered')::BOOLEAN,
  FALSE,
  'Does not trigger duplicate alerts when an active alert exists'
);

ROLLBACK;
