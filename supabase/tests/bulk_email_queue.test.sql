-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 6 tests)
SELECT plan(6);

-- Test 1: Check if bulk_email_jobs table exists
SELECT has_table('public', 'bulk_email_jobs', 'Table bulk_email_jobs should exist');

-- Test 2: Check columns on bulk_email_jobs table
SELECT has_column('public', 'bulk_email_jobs', 'status', 'Column status should exist on bulk_email_jobs');
SELECT has_column('public', 'bulk_email_jobs', 'processed_count', 'Column processed_count should exist on bulk_email_jobs');

-- Test 3: Check get_club_member_emails function exists
SELECT has_function('public', 'get_club_member_emails', ARRAY['uuid'], 'Function get_club_member_emails(uuid) should exist');

-- Test 4: Check dequeue_bulk_email_job function exists
SELECT has_function('public', 'dequeue_bulk_email_job', 'Function dequeue_bulk_email_job() should exist');

-- Test 5: Verify RLS is enabled on bulk_email_jobs
SELECT rls_enabled('public', 'bulk_email_jobs', 'RLS should be enabled on bulk_email_jobs');

-- Finish the tests and clean up
SELECT * FROM finish();
ROLLBACK;
