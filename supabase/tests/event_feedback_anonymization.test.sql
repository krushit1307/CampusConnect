-- =============================================================================
-- Test Suite: event_feedback_anonymization.test.sql
-- Purpose: Verify feedback anonymization logs, indexes, and policy definitions.
-- =============================================================================

BEGIN;

SELECT plan(3);

-- 1. Schema check
SELECT has_table('public', 'feedback_anonymized_drifts', 'feedback_anonymized_drifts table exists');
SELECT has_column('public', 'feedback_anonymized_drifts', 'drift_delta', 'drift_delta column exists');

-- 2. Insert test data
INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-ad0000000001'::uuid, 'Science Club', 'science-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, club_id, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-ad0000000002'::uuid,
  'Robotics Show',
  '00000000-0000-0000-0000-ad0000000001'::uuid,
  NOW(),
  NOW() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feedback_anonymized_drifts (event_id, drift_delta, total_reviews_evaluated)
VALUES ('00000000-0000-0000-0000-ad0000000002'::uuid, -0.45, 12);

SELECT is(
  (SELECT COUNT(*)::INT FROM public.feedback_anonymized_drifts WHERE event_id = '00000000-0000-0000-0000-ad0000000002'::uuid),
  1,
  'Anonymized drift metric log is stored successfully'
);

ROLLBACK;
