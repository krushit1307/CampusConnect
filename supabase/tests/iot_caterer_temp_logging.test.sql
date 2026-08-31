-- =============================================================================
-- Test Suite: iot_caterer_temp_logging.test.sql
-- Purpose: Verify food safety timeseries IoT validations, FDA danger zone
--          duration triggers, and automated Stripe blocks.
-- =============================================================================

BEGIN;

SELECT plan(7);

-- 1. Verify schema tables and columns
SELECT has_column('public', 'event_caterer_contracts', 'shipment_status', 'event_caterer_contracts has shipment_status');
SELECT has_column('public', 'event_caterer_contracts', 'stripe_payment_blocked', 'event_caterer_contracts has stripe_payment_blocked');
SELECT has_table('public', 'caterer_iot_temp_logs', 'caterer_iot_temp_logs table exists');

-- Setup test seeds
-- Profiles
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-ca0000000001'::uuid, 'Event Organizer', 'student')
ON CONFLICT (id) DO NOTHING;

-- Event
INSERT INTO public.events (id, club_id, title, created_by)
VALUES (
  '00000000-0000-0000-0000-ca0000000002'::uuid,
  '00000000-0000-0000-0000-da0000000004'::uuid, -- Reusing Dutch Club uuid from seeds
  'Safety Catered Event',
  '00000000-0000-0000-0000-ca0000000001'::uuid
)
ON CONFLICT (id) DO NOTHING;

-- Event Caterer Contract
INSERT INTO public.event_caterer_contracts (id, event_id, caterer_name, caterer_email, rfp_finalized_at)
VALUES (
  '00000000-0000-0000-0000-ca0000000003'::uuid,
  '00000000-0000-0000-0000-ca0000000002'::uuid,
  'Safe Catering Inc',
  'chef@safecater.com',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test Safe Timeseries (temperatures mostly <= 40°F, or above 40°F for only 30 minutes)
SELECT is(
  (public.upload_caterer_temp_logs(
    '00000000-0000-0000-0000-ca0000000003'::uuid,
    '[
      {"recorded_at": "2026-08-28T12:00:00Z", "temperature_fahrenheit": 38.0},
      {"recorded_at": "2026-08-28T12:30:00Z", "temperature_fahrenheit": 42.0},
      {"recorded_at": "2026-08-28T13:00:00Z", "temperature_fahrenheit": 38.0},
      {"recorded_at": "2026-08-28T14:00:00Z", "temperature_fahrenheit": 39.0}
    ]'::jsonb
  ) ->> 'shipment_status')::TEXT,
  'SAFE',
  'Caterer shipment is marked SAFE if FDA danger zone duration is not exceeded'
);

-- Verify payment is NOT blocked
SELECT is(
  (SELECT stripe_payment_blocked FROM public.event_caterer_contracts WHERE id = '00000000-0000-0000-0000-ca0000000003'::uuid),
  FALSE,
  'Stripe payment remains active for safe food deliveries'
);

-- 3. Test Violating Timeseries (temperature > 40°F for more than 2 consecutive hours)
SELECT is(
  (public.upload_caterer_temp_logs(
    '00000000-0000-0000-0000-ca0000000003'::uuid,
    '[
      {"recorded_at": "2026-08-28T12:00:00Z", "temperature_fahrenheit": 41.0},
      {"recorded_at": "2026-08-28T13:00:00Z", "temperature_fahrenheit": 43.0},
      {"recorded_at": "2026-08-28T14:15:00Z", "temperature_fahrenheit": 42.5},
      {"recorded_at": "2026-08-28T15:00:00Z", "temperature_fahrenheit": 39.0}
    ]'::jsonb
  ) ->> 'shipment_status')::TEXT,
  'CONDEMNED',
  'Caterer shipment is CONDEMNED if FDA danger zone duration (2+ hours) is exceeded'
);

-- Verify Stripe payment is BLOCKED and notification dispatched
SELECT is(
  (SELECT stripe_payment_blocked FROM public.event_caterer_contracts WHERE id = '00000000-0000-0000-0000-ca0000000003'::uuid),
  TRUE,
  'Stripe payment is automatically blocked for condemned shipments'
);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.notifications 
   WHERE user_id = '00000000-0000-0000-0000-ca0000000001'::uuid AND type = 'food_safety_alert'),
  1,
  'Food safety notification is successfully dispatched to the organizer'
);

ROLLBACK;
