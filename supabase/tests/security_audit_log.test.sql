-- ============================================================
-- Test Suite: security_audit_log.test.sql
-- Description: Verifies security_audit_log table, immutability,
--              and RLS bypass logging.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (6 tests)
SELECT plan(6);

-- Test 1: Verify security_audit_log table exists
SELECT has_table('public', 'security_audit_log', 'Table public.security_audit_log should exist');

-- Test 2: Verify trigger enforce_immutable_audit_log exists
SELECT has_trigger(
  'public',
  'security_audit_log',
  'enforce_immutable_audit_log',
  'Trigger enforce_immutable_audit_log should be attached to security_audit_log'
);

-- Setup Mock Data (users, club, event)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('h0000000-0000-0000-0000-000000000001', 'organizer@cc.edu', 'authenticated', 'authenticated'),
  ('h0000000-0000-0000-0000-000000000002', 'user1@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('h0000000-0000-0000-0000-000000000100', 'Security Club', 'security-club', 'h0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, location, created_by, event_date, max_attendees)
VALUES ('h0000000-0000-0000-0000-000000000200', 'h0000000-0000-0000-0000-000000000100', 'Secure Event', 'Room A', 'h0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '2 days', 50)
ON CONFLICT (id) DO NOTHING;

-- Test 3: Call secure_event_checkout (SECURITY DEFINER)
SELECT is(
  public.secure_event_checkout('h0000000-0000-0000-0000-000000000200'::uuid, 'h0000000-0000-0000-0000-000000000002'::uuid),
  'SUCCESS',
  'User checks out successfully'
);

-- Test 4: Verify audit entry is written to security_audit_log
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.security_audit_log
    WHERE function_name = 'secure_event_checkout'
      AND action = 'INSERT'
      AND target_table = 'event_rsvps'
      AND target_id = 'h0000000-0000-0000-0000-000000000200'::uuid
  ),
  'Bypass audit log record is written successfully'
);

-- Test 5: Verify updates to security_audit_log are rejected with hard exception
SELECT throws_matching(
  $$UPDATE public.security_audit_log SET action = 'UPDATE' WHERE function_name = 'secure_event_checkout'$$,
  'Updates or deletes on security_audit_log are not allowed.',
  'Modifying security_audit_log via UPDATE is prohibited'
);

-- Test 6: Verify deletes to security_audit_log are rejected with hard exception
SELECT throws_matching(
  $$DELETE FROM public.security_audit_log WHERE function_name = 'secure_event_checkout'$$,
  'Updates or deletes on security_audit_log are not allowed.',
  'Modifying security_audit_log via DELETE is prohibited'
);

SELECT * FROM finish();
ROLLBACK;
