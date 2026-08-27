-- ============================================================
-- Test Suite: multi_factor_role_transfers.test.sql
-- Description: Verifies Student Union Advisor approval gates on presidency role handovers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(9);

-- 1. Check schema components
SELECT has_column('public', 'clubs', 'advisor_id', 'clubs should have advisor_id column');
SELECT has_column('public', 'clubs', 'advisor_email', 'clubs should have advisor_email column');
SELECT has_column('public', 'leadership_transitions', 'su_advisor_approval_status', 'leadership_transitions should have su_advisor_approval_status column');

-- 2. Mock users, club and transition setup
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000f11', 'current-pres@campus.edu'),
    ('00000000-0000-0000-0000-000000000f12', 'successor-pres@campus.edu'),
    ('00000000-0000-0000-0000-000000000f13', 'advisor-staff@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000f11', 'Outgoing', 'Pres', 'out_pres', 'current-pres@campus.edu'),
    ('00000000-0000-0000-0000-000000000f12', 'Incoming', 'Successor', 'in_successor', 'successor-pres@campus.edu'),
    ('00000000-0000-0000-0000-000000000f13', 'Staff', 'Advisor', 'staff_advisor', 'advisor-staff@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by, advisor_id, advisor_email)
VALUES (
    '00000000-0000-0000-0000-000000000fc1',
    'Transfers Club',
    'transfers-club',
    '00000000-0000-0000-0000-000000000f11',
    '00000000-0000-0000-0000-000000000f13',
    'advisor-staff@campus.edu'
)
ON CONFLICT (id) DO NOTHING;

-- Set up roles: President & Alumni
SELECT president_role_id, alumni_role_id 
FROM public.ensure_club_transition_roles('00000000-0000-0000-0000-000000000fc1');

-- Assign current president role
INSERT INTO public.club_members (club_id, user_id, role_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000fc1',
    '00000000-0000-0000-0000-000000000f11',
    (SELECT id FROM public.club_roles WHERE club_id = '00000000-0000-0000-0000-000000000fc1' AND title = 'President'),
    'approved'
)
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Assign successor member role
INSERT INTO public.club_members (club_id, user_id, role_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000fc1',
    '00000000-0000-0000-0000-000000000f12',
    (SELECT id FROM public.club_roles WHERE club_id = '00000000-0000-0000-0000-000000000fc1' AND title = 'Alumni'), -- just an approved member role for this test
    'approved'
)
ON CONFLICT (club_id, user_id) DO NOTHING;

-- 3. Run nominate_successor as current president
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000f11';

DECLARE
  v_trans_id UUID;
BEGIN
  v_trans_id := public.nominate_successor(
    '00000000-0000-0000-0000-000000000fc1',
    '00000000-0000-0000-0000-000000000f12',
    now() + INTERVAL '1 day',
    'President'
  );
END;

-- Let's check status is pending su advisor approval
SELECT results_eq(
    $$
    SELECT su_advisor_approval_status FROM public.leadership_transitions 
    WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    ARRAY['pending'::public.su_advisor_approval_status],
    'Nominated successor transition should start with su_advisor_approval_status as pending'
);

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.outbox_events 
    WHERE (payload->>'table') = 'leadership_transitions' AND (payload->>'action') = 'TRANSITION_INITIATED';
    $$,
    ARRAY[1],
    'A transition outbox event should be enqueued upon nomination initiation'
);

-- Successor accepts the nomination
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000f12'; -- Successor

SELECT lives_ok(
    $$
    SELECT public.accept_nomination(id) FROM public.leadership_transitions WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    'Successor accepts the nomination'
);

-- 4. Try executing: should fail to execute because su advisor hasn't approved it yet
SELECT lives_ok(
    $$
    SELECT public.execute_one_leadership_transition(id) FROM public.leadership_transitions WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    'Execution attempt runs without exceptions'
);

SELECT results_eq(
    $$
    SELECT status FROM public.leadership_transitions WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    ARRAY['accepted'::public.transition_status],
    'Transition status should remain accepted (not completed) because su advisor approval is pending'
);

-- 5. Advisor approves the transition
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000f13'; -- Advisor

SELECT lives_ok(
    $$
    SELECT public.approve_leadership_transfer(id) FROM public.leadership_transitions WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    'Advisor approves the transition'
);

SELECT results_eq(
    $$
    SELECT status FROM public.leadership_transitions WHERE club_id = '00000000-0000-0000-0000-000000000fc1';
    $$,
    ARRAY['completed'::public.transition_status],
    'Transition should be completed immediately after advisor approval'
);

ROLLBACK;
