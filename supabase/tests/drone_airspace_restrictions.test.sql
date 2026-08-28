-- ============================================================
-- Test Suite: drone_airspace_restrictions.test.sql
-- Description: Verifies 'Drone Airspace Restriction Integration' (#4813)
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);

-- 1. Check Tables and Columns
SELECT has_table('public', 'temporary_flight_restrictions', 'temporary_flight_restrictions table should exist');
SELECT has_column('public', 'temporary_flight_restrictions', 'restriction_date', 'temporary_flight_restrictions should have restriction_date');
SELECT has_column('public', 'temporary_flight_restrictions', 'reason', 'temporary_flight_restrictions should have reason');

-- 2. Mock Setup
-- Add mock club, users, inventory items (one drone, one non-drone)
INSERT INTO public.clubs (id, name, slug)
VALUES ('88888888-8888-8888-8888-aaaaaaaaaaaa', 'Aviation Club', 'aviation-club')
ON CONFLICT (id) DO NOTHING;

-- Renter club admin setup
INSERT INTO public.profiles (id, first_name, last_name)
VALUES ('88888888-8888-8888-8888-uuuuuuuuuuuu', 'Drone', 'Pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES ('88888888-8888-8888-8888-aaaaaaaaaaaa', '88888888-8888-8888-8888-uuuuuuuuuuuu', 'admin', 'approved')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Drone item
INSERT INTO public.inventory_items (id, club_id, name, barcode, category, daily_rental_rate, is_rentable, is_active)
VALUES (
    '88888888-8888-8888-8888-dddddddddddd', 
    '88888888-8888-8888-8888-aaaaaaaaaaaa', 
    'Quadcopter Drone', 
    'DRONE-BARCODE-01', 
    'drones', 
    5000, 
    true, 
    true
)
ON CONFLICT (id) DO NOTHING;

-- Non-drone item
INSERT INTO public.inventory_items (id, club_id, name, barcode, category, daily_rental_rate, is_rentable, is_active)
VALUES (
    '88888888-8888-8888-8888-ffffffffffff', 
    '88888888-8888-8888-8888-aaaaaaaaaaaa', 
    'Folding Table', 
    'TABLE-BARCODE-01', 
    'furniture', 
    1000, 
    true, 
    true
)
ON CONFLICT (id) DO NOTHING;

-- Active TFR mock date
INSERT INTO public.temporary_flight_restrictions (restriction_date, reason)
VALUES (
    (NOW() + INTERVAL '2 days')::date,
    'VIP Visit: POTUS flight restriction active'
)
ON CONFLICT (restriction_date) DO NOTHING;

-- Mock authentication session
SELECT test_val AS auth_uid FROM text (
    SELECT '88888888-8888-8888-8888-uuuuuuuuuuuu'
) \gset
-- Set current user id in session settings
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-uuuuuuuuuuuu')::text, true);

-- 3. Test booking Drone when NO airspace restriction is active on booking dates
-- Booking for tomorrow (1 day duration)
SELECT lives_ok(
    $$ SELECT public.request_equipment_rental(
        '88888888-8888-8888-8888-dddddddddddd',
        '88888888-8888-8888-8888-aaaaaaaaaaaa',
        NOW() + INTERVAL '1 day',
        NOW() + INTERVAL '1 day 5 hours'
    ) $$,
    'Should allow drone booking when no TFR is active on booking dates'
);

-- 4. Test booking Drone when airspace restriction IS active on booking dates (2 days from now)
SELECT throws_like(
    $$ SELECT public.request_equipment_rental(
        '88888888-8888-8888-8888-dddddddddddd',
        '88888888-8888-8888-8888-aaaaaaaaaaaa',
        NOW() + INTERVAL '2 days',
        NOW() + INTERVAL '2 days 5 hours'
    ) $$,
    '%Airspace Restricted: A Temporary Flight Restriction is active on this date. Drones cannot be flown. Booking denied for legal compliance.%',
    'Should throw error and deny drone booking if TFR overlaps booking dates'
);

-- 5. Test booking Non-Drone when airspace restriction IS active on booking dates (should succeed!)
SELECT lives_ok(
    $$ SELECT public.request_equipment_rental(
        '88888888-8888-8888-8888-ffffffffffff',
        '88888888-8888-8888-8888-aaaaaaaaaaaa',
        NOW() + INTERVAL '2 days',
        NOW() + INTERVAL '2 days 5 hours'
    ) $$,
    'Should allow non-drone booking even if TFR is active'
);

ROLLBACK;
