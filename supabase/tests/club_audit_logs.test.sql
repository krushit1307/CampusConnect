-- ============================================================
-- Test Suite: club_audit_logs.test.sql
-- Issue: #1952
-- Description: Verifies club_audit_logs table columns, trigger execution on club updates,
--              capturing old and new record states, and storage bloat optimization.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Test 1: Check club_audit_logs table exists
SELECT has_table('public', 'club_audit_logs', 'Table club_audit_logs should exist');

-- Test 2: Check columns on club_audit_logs table
SELECT has_column('public', 'club_audit_logs', 'id', 'Column id should exist on club_audit_logs');
SELECT has_column('public', 'club_audit_logs', 'club_id', 'Column club_id should exist on club_audit_logs');
SELECT has_column('public', 'club_audit_logs', 'action_type', 'Column action_type should exist on club_audit_logs');
SELECT has_column('public', 'club_audit_logs', 'old_data', 'Column old_data should exist on club_audit_logs');
SELECT has_column('public', 'club_audit_logs', 'new_data', 'Column new_data should exist on club_audit_logs');
SELECT has_column('public', 'club_audit_logs', 'changed_at', 'Column changed_at should exist on club_audit_logs');

-- Setup test profile for creator
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('80000000-0000-0000-0000-000000000001', 'clubauditcreator@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Audit Creator"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('80000000-0000-0000-0000-000000000001', 'Club Audit', 'Creator', 'student')
ON CONFLICT (id) DO NOTHING;

-- Insert club to start with
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('80000000-0000-0000-0000-000000000002', 'Chess Club', 'chess-club', 'Original Chess Description', '80000000-0000-0000-0000-000000000001');

-- Test 3: Clear any initial audit log entries to start clean
DELETE FROM public.club_audit_logs;

-- Update club name from "Chess Club" to "Grandmaster Chess"
UPDATE public.clubs
SET name = 'Grandmaster Chess'
WHERE id = '80000000-0000-0000-0000-000000000002';

-- Test 4: Verify audit log row exists with name change
SELECT is(
  (
    SELECT COUNT(*)::INT 
    FROM public.club_audit_logs 
    WHERE club_id = '80000000-0000-0000-0000-000000000002'
      AND action_type = 'UPDATE' 
      AND old_data->>'name' = 'Chess Club'
      AND new_data->>'name' = 'Grandmaster Chess'
  ),
  1,
  'Updating a club name creates an audit log entry'
);

-- Test 5: Verify unchanged fields (like description) are NOT in the audit log (storage bloat check)
SELECT ok(
  (
    SELECT (old_data->'description' IS NULL AND new_data->'description' IS NULL)
    FROM public.club_audit_logs 
    WHERE club_id = '80000000-0000-0000-0000-000000000002'
    LIMIT 1
  ),
  'Unchanged fields (like description) should not be captured in the diff to avoid bloat'
);

-- Update the club again without changing any fields
UPDATE public.clubs
SET name = 'Grandmaster Chess'
WHERE id = '80000000-0000-0000-0000-000000000002';

-- Test 6: Verify no new audit log entry was created since nothing changed
SELECT is(
  (
    SELECT COUNT(*)::INT 
    FROM public.club_audit_logs 
    WHERE club_id = '80000000-0000-0000-0000-000000000002'
  ),
  1,
  'Updating a club without changing any fields does not create an audit log'
);

SELECT * FROM finish();
ROLLBACK;
