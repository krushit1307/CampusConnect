-- ============================================================
-- Test Suite: quiet_hours_scheduler.test.sql
-- Description: Verifies columns on user_preferences, delayed_notifications table structure,
--              and quiet hours helper RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- Test 1: Check quiet hours columns exist on user_preferences
SELECT has_column('public', 'user_preferences', 'quiet_hours_start', 'Column quiet_hours_start should exist on user_preferences');
SELECT has_column('public', 'user_preferences', 'quiet_hours_end', 'Column quiet_hours_end should exist on user_preferences');

-- Test 2: Check delayed_notifications table exists
SELECT has_table('public', 'delayed_notifications', 'Table delayed_notifications should exist');

-- Test 3: Check columns on delayed_notifications table
SELECT has_column('public', 'delayed_notifications', 'id', 'Column id should exist on delayed_notifications');
SELECT has_column('public', 'delayed_notifications', 'user_id', 'Column user_id should exist on delayed_notifications');
SELECT has_column('public', 'delayed_notifications', 'type', 'Column type should exist on delayed_notifications');
SELECT has_column('public', 'delayed_notifications', 'payload', 'Column payload should exist on delayed_notifications');

-- Test 4: Check if dispatch_delayed_notifications function exists
SELECT has_function('public', 'dispatch_delayed_notifications', 'Function dispatch_delayed_notifications should exist');

SELECT * FROM finish();
ROLLBACK;
