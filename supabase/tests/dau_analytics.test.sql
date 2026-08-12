-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock users
-- 1. System Admin User
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000701', 'sysadmin@test.com', 'authenticated', 'authenticated', '{"full_name": "System Admin"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles 
SET role = 'system_admin', full_name = 'System Admin' 
WHERE id = '90000000-0000-0000-0000-000000000701';

-- 2. Normal Member User
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000702', 'member@test.com', 'authenticated', 'authenticated', '{"full_name": "Normal Member"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles 
SET role = 'member', full_name = 'Normal Member' 
WHERE id = '90000000-0000-0000-0000-000000000702';

-- Add mock activity sessions
INSERT INTO public.user_sessions (user_id, activity_date)
VALUES 
  ('90000000-0000-0000-0000-000000000701', '2026-07-28'::DATE),
  ('90000000-0000-0000-0000-000000000702', '2026-07-28'::DATE),
  ('90000000-0000-0000-0000-000000000701', '2026-07-29'::DATE);

-- Manually refresh the materialized view since we inserted new data
REFRESH MATERIALIZED VIEW public.daily_active_users_summary;


-- ==========================================
-- Test Case 1: get_dau_analytics exists
-- ==========================================
SELECT has_function(
  'public',
  'get_dau_analytics',
  'get_dau_analytics should exist in schema public'
);

-- ==========================================
-- Test Case 2: Materialized view daily_active_users_summary exists
-- ==========================================
SELECT has_relation(
  'public',
  'daily_active_users_summary',
  'daily_active_users_summary materialized view should exist'
);

-- ==========================================
-- Test Case 3: daily_active_users_90_days view works
-- ==========================================
SELECT results_eq(
  $$SELECT daily_active_users::INTEGER FROM public.daily_active_users_90_days WHERE activity_date = '2026-07-28'::DATE$$,
  $$VALUES (2)$$,
  'daily_active_users_90_days should return 2 active users for 2026-07-28'
);

-- ==========================================
-- Test Case 4: Execution works when authenticated as system_admin
-- ==========================================
-- Set local role to authenticated and mock sysadmin UID
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "90000000-0000-0000-0000-000000000701"}';

SELECT results_eq(
  $$SELECT daily_active_users::INTEGER FROM public.get_dau_analytics() WHERE activity_date = '2026-07-28'::DATE$$,
  $$VALUES (2)$$,
  'Should successfully retrieve aggregated DAU when authenticated as system_admin'
);

-- ==========================================
-- Test Case 5: Execution is blocked when authenticated as normal member
-- ==========================================
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "90000000-0000-0000-0000-000000000702"}';

SELECT throws_ok(
  $$SELECT * FROM public.get_dau_analytics()$$,
  'Access denied. System admin privileges required.',
  'Should reject query with access denied message when authenticated as regular member'
);

-- ==========================================
-- Test Case 6: Execution is blocked for anonymous requests
-- ==========================================
SET LOCAL role TO anon;
SET LOCAL request.jwt.claims TO '{}';

SELECT throws_ok(
  $$SELECT * FROM public.get_dau_analytics()$$,
  'permission denied for function get_dau_analytics',
  'Should throw permission denied error for anonymous requests'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
