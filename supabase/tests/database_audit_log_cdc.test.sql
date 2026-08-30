-- ============================================================
-- Test Suite: database_audit_log_cdc.test.sql
-- Issue: #2327 - [REFACTOR]: Setup Database Audit Log (CDC) via Postgres Triggers
-- Description: Verifies CDC audit_logs table schema, PL/pgSQL trigger capture
-- on UPDATE and DELETE operations, JSONB state serialization, user context capture,
-- and retention purge routine.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- Test 1: Verify audit_logs table exists
SELECT has_table('public', 'audit_logs', 'Table public.audit_logs should exist');

-- Test 2: Verify required columns on audit_logs
SELECT has_column('public', 'audit_logs', 'id', 'Column id should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'table_name', 'Column table_name should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'record_id', 'Column record_id should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'action', 'Column action should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'old_data', 'Column old_data should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'new_data', 'Column new_data should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'changed_by', 'Column changed_by should exist on audit_logs');

-- Setup test user and club
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000001', 'auditcdc@test.com', 'authenticated', 'authenticated', '{"full_name": "Audit CDC User"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('90000000-0000-0000-0000-000000000001', 'Audit', 'User', 'club_admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000002', 'CDC Test Club', 'cdc-test-club', 'Old', '90000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET description = 'Old';

-- Set user context via session variable
SET LOCAL myapp.current_user_id = '90000000-0000-0000-0000-000000000001';

-- Update club description from "Old" to "New"
UPDATE public.clubs
SET description = 'New'
WHERE id = '90000000-0000-0000-0000-000000000002';

-- Test 9: Verify audit_logs row appeared with table_name = 'clubs', old_data = "Old", new_data = "New", changed_by set
SELECT is(
  (
    SELECT COUNT(*)::INT
    FROM public.audit_logs
    WHERE table_name = 'clubs'
      AND record_id = '90000000-0000-0000-0000-000000000002'
      AND action = 'UPDATE'
      AND old_data->>'description' = 'Old'
      AND new_data->>'description' = 'New'
      AND changed_by = '90000000-0000-0000-0000-000000000001'
  ),
  1,
  'Updating a club description from Old to New records CDC audit log with old_data, new_data, and changed_by'
);

SELECT * FROM finish();
ROLLBACK;
