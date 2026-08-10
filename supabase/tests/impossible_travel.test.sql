BEGIN;
SELECT plan(10);

-- 1. Check columns exist in profiles
SELECT has_column('public', 'profiles', 'is_locked', 'profiles table should have is_locked column');
SELECT col_type_is('public', 'profiles', 'is_locked', 'boolean', 'is_locked should be boolean');

SELECT has_column('public', 'profiles', 'unlock_token', 'profiles table should have unlock_token column');
SELECT col_type_is('public', 'profiles', 'unlock_token', 'uuid', 'unlock_token should be uuid');

-- 2. Check login_history table exists
SELECT has_table('public', 'login_history', 'login_history table should exist');
SELECT has_column('public', 'login_history', 'user_id', 'login_history table should have user_id column');
SELECT has_column('public', 'login_history', 'latitude', 'login_history table should have latitude column');

-- 3. Create a test user for impossible travel checks
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000001331', 'traveler@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000001331', 'Test Traveler', 'student')
ON CONFLICT (id) DO NOTHING;

-- 4. Test normal travel scenario (possible travel)
-- Baseline login: New York (40.7128, -74.0060) 1 hour ago
INSERT INTO public.login_history (user_id, ip_address, latitude, longitude, city, country, login_at)
VALUES (
    '00000000-0000-0000-0000-000000001331',
    '1.1.1.1',
    40.7128,
    -74.0060,
    'New York',
    'United States',
    now() - interval '1 hour'
);

-- Test travel to Philadelphia (39.9526, -75.1652) 1 hour later (distance is ~130 km, speed is 130 km/h, which is < 1000 km/h)
SELECT is(
    public.check_impossible_travel('00000000-0000-0000-0000-000000001331', 39.9526, -75.1652),
    FALSE,
    'Travel from New York to Philadelphia in 1 hour is possible and should NOT be marked impossible'
);

-- 5. Test impossible travel scenario
-- Clear login history and insert a fresh baseline to keep test isolated
DELETE FROM public.login_history WHERE user_id = '00000000-0000-0000-0000-000000001331';

INSERT INTO public.login_history (user_id, ip_address, latitude, longitude, city, country, login_at)
VALUES (
    '00000000-0000-0000-0000-000000001331',
    '1.1.1.1',
    40.7128,
    -74.0060,
    'New York',
    'United States',
    now() - interval '5 minutes'
);

-- Test travel to London (51.5074, -0.1278) 5 minutes later (distance is ~5500 km, speed is 66,000 km/h, which is > 1000 km/h)
SELECT is(
    public.check_impossible_travel('00000000-0000-0000-0000-000000001331', 51.5074, -0.1278),
    TRUE,
    'Travel from New York to London in 5 minutes is physically impossible and SHOULD be marked impossible'
);

-- 6. Test near-instantaneous check (prevent division by zero)
-- Clear login history and insert a fresh baseline
DELETE FROM public.login_history WHERE user_id = '00000000-0000-0000-0000-000000001331';

INSERT INTO public.login_history (user_id, ip_address, latitude, longitude, city, country, login_at)
VALUES (
    '00000000-0000-0000-0000-000000001331',
    '1.1.1.1',
    40.7128,
    -74.0060,
    'New York',
    'United States',
    now() - interval '2 seconds'
);

-- Test travel to London 2 seconds later (distance ~5500 km)
SELECT is(
    public.check_impossible_travel('00000000-0000-0000-0000-000000001331', 51.5074, -0.1278),
    TRUE,
    'Travel from New York to London in 2 seconds is impossible'
);

SELECT * FROM finish();
ROLLBACK;
