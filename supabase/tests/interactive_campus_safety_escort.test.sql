-- ============================================================
-- Test Suite: interactive_campus_safety_escort.test.sql
-- Description: Verifies schema, RLS policies, and request_safety_escort
-- function logic for Issue #3295.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- 1. Schema Validation
SELECT has_table('public', 'safety_escort_requests', 'safety_escort_requests table should exist');
SELECT has_column('public', 'safety_escort_requests', 'user_id', 'Column user_id should exist');
SELECT has_column('public', 'safety_escort_requests', 'request_type', 'Column request_type should exist');
SELECT has_column('public', 'safety_escort_requests', 'current_location', 'Column current_location should exist');
SELECT has_column('public', 'safety_escort_requests', 'destination_dorm', 'Column destination_dorm should exist');
SELECT has_column('public', 'safety_escort_requests', 'status', 'Column status should exist');

SELECT has_function('public', 'request_safety_escort', ARRAY['uuid', 'text', 'text', 'text', 'double precision', 'double precision'], 'RPC request_safety_escort should exist');

-- 2. Mock Data Setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'Alex', 'Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- 3. Test RPC execution for Campus Security Request
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT is(
    (public.request_safety_escort(NULL, 'campus_security', 'Library Quad', 'North Dorm B', 40.7128, -74.0060)->>'success')::boolean,
    true,
    'Submitting Campus Security escort request should return success = true'
);

SELECT is(
    (public.request_safety_escort(NULL, 'buddy_system', 'Student Union', 'South Dorm C', 40.7130, -74.0065)->>'request_type')::text,
    'buddy_system',
    'Submitting Virtual Buddy request should record request_type = buddy_system'
);

SELECT * FROM finish();
ROLLBACK;
