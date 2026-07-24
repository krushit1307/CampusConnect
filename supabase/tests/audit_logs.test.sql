-- pgTAP Test: Audit Logs
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- Test 1: Check audit_logs table exists
SELECT has_table('public', 'audit_logs', 'Table audit_logs should exist');

-- Test 2: Check columns on audit_logs table
SELECT has_column('public', 'audit_logs', 'action', 'Column action should exist on audit_logs');
SELECT has_column('public', 'audit_logs', 'target_table', 'Column target_table should exist on audit_logs');

-- Setup test profile for creator
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('70000000-0000-0000-0000-000000000001', 'auditcreator@test.com', 'authenticated', 'authenticated', '{"full_name": "Audit Creator"}')
ON CONFLICT (id) DO NOTHING;

-- Insert club to trigger audit log
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('70000000-0000-0000-0000-000000000002', 'Audit Test Club', 'audit-test-club', 'Testing audit log triggers', '70000000-0000-0000-0000-000000000001');

-- Test 3: Check that insertion into clubs table generated an audit log entry
SELECT is(
  (SELECT COUNT(*)::INT FROM public.audit_logs WHERE target_table = 'clubs' AND action = 'INSERT' AND record_id = '70000000-0000-0000-0000-000000000002'),
  1,
  'Inserting a club creates an audit log entry'
);

SELECT * FROM finish();
ROLLBACK;
