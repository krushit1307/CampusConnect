-- ============================================================
-- Test Suite: dead_letter_queue.test.sql
-- Description: Verifies dead_letter_queue table columns and trigger-based auto-purging logic.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- Test 1: Check dead_letter_queue table exists
SELECT has_table('public', 'dead_letter_queue', 'Table dead_letter_queue should exist');

-- Test 2: Check columns on dead_letter_queue table
SELECT has_column('public', 'dead_letter_queue', 'id', 'Column id should exist on dead_letter_queue');
SELECT has_column('public', 'dead_letter_queue', 'payload', 'Column payload should exist on dead_letter_queue');
SELECT has_column('public', 'dead_letter_queue', 'error_message', 'Column error_message should exist on dead_letter_queue');
SELECT has_column('public', 'dead_letter_queue', 'attempt_count', 'Column attempt_count should exist on dead_letter_queue');

-- Test 3: Insert items (some older than 7 days, some new) and verify auto-purging trigger runs
-- Manually override created_at for one item to simulate age of 10 days
INSERT INTO public.dead_letter_queue (id, payload, error_message, attempt_count, created_at)
VALUES (
    '80000000-0000-0000-0000-000000000001',
    '{"to": "old@test.com", "subject": "Old Welcome", "body": "HTML Body"}'::jsonb,
    'Invalid API Key',
    3,
    NOW() - INTERVAL '10 days'
);

-- Insert a fresh item which should trigger the AFTER INSERT purge function
INSERT INTO public.dead_letter_queue (id, payload, error_message, attempt_count, created_at)
VALUES (
    '80000000-0000-0000-0000-000000000002',
    '{"to": "fresh@test.com", "subject": "New Welcome", "body": "HTML Body"}'::jsonb,
    'Invalid API Key',
    3,
    NOW()
);

-- Verify the 10-day-old item was purged and the fresh item remains
SELECT is(
    (SELECT COUNT(*)::INT FROM public.dead_letter_queue),
    1,
    'Items older than 7 days are automatically purged'
);

SELECT * FROM finish();
ROLLBACK;
