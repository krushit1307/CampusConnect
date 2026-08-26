-- ============================================================
-- Test Suite: audit_logs.test.sql
-- Issue: #1183
-- Description: Verifies audit_logs table columns, trigger execution on club updates,
--              capturing old and new record states, and immutability protection.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (6 tests)
SELECT plan(6);

-- Test 1: Check audit_logs table exists
SELECT has_table('public', 'audit_logs', 'Table audit_logs should exist');

-- Test 2: Check columns on audit_logs table
SELECT has_column('public', 'audit_logs', 'admin_id', 'Column admin_id should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'old_value', 'Column old_value should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'new_value', 'Column new_value should exist on audit_logs');

-- Setup test profile for creator
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('70000000-0000-0000-0000-000000000001', 'auditcreator@test.com', 'authenticated', 'authenticated', '{"full_name": "Audit Creator"}')
ON CONFLICT (id) DO NOTHING;

-- Insert club to trigger initial audit log
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('70000000-0000-0000-0000-000000000002', 'Audit Test Club', 'audit-test-club', 'Original Description', '70000000-0000-0000-0000-000000000001');

-- Update club description to trigger AFTER UPDATE audit log
UPDATE public.clubs
SET description = 'Updated Description'
WHERE id = '70000000-0000-0000-0000-000000000002';

-- Test 5: Verify UPDATE trigger generated audit log entry with OLD and NEW values
SELECT is(
  (
    SELECT COUNT(*)::INT 
    FROM public.audit_logs 
    WHERE target_table = 'clubs' 
      AND action = 'UPDATE' 
      AND record_id = '70000000-0000-0000-0000-000000000002'
      AND old_value->>'description' = 'Original Description'
      AND new_value->>'description' = 'Updated Description'
  ),
  1,
  'Updating a club description creates an audit log entry capturing old_value and new_value'
);

-- Test 6: Verify immutability - attempting to delete an audit log row raises an exception
SELECT throws_ok(
  $$ DELETE FROM public.audit_logs WHERE target_table = 'clubs' $$,
  'Audit logs are immutable and cannot be updated or deleted.',
  'Audit log deletion is blocked by immutability trigger'
);

SELECT * FROM finish();
ROLLBACK;
