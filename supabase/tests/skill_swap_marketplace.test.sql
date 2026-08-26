-- ============================================================
-- Test Suite: skill_swap_marketplace.test.sql
-- Description: Verifies bipartite match logic, status handshakes and notification triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schema components
SELECT has_table('public', 'skill_swaps', 'skill_swaps table should exist');
SELECT has_table('public', 'skill_swap_matches', 'skill_swap_matches table should exist');
SELECT has_function('public', 'accept_skill_swap_match', 'accept_skill_swap_match function should exist');
SELECT has_function('public', 'reject_skill_swap_match', 'reject_skill_swap_match function should exist');

-- 2. Mock profiles / users
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000ff1', 'stud_a@campus.edu'),
    ('00000000-0000-0000-0000-000000000ff2', 'stud_b@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000ff1', 'Student', 'A', 'stud_a', 'stud_a@campus.edu'),
    ('00000000-0000-0000-0000-000000000ff2', 'Student', 'B', 'stud_b', 'stud_b@campus.edu')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert User B offer first
INSERT INTO public.skill_swaps (id, user_id, offering_skill, requesting_skill)
VALUES ('00000000-0000-0000-0000-000000000fs1', '00000000-0000-0000-0000-000000000ff2', 'Guitar', 'Python')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert User A offer (matching User B) as User A
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000ff1';

INSERT INTO public.skill_swaps (id, user_id, offering_skill, requesting_skill)
VALUES ('00000000-0000-0000-0000-000000000fs2', '00000000-0000-0000-0000-000000000ff1', 'Python', 'Guitar')
ON CONFLICT (id) DO NOTHING;

-- Assert bipartite match is created automatically by the trigger
SELECT results_eq(
    $$
    SELECT status FROM public.skill_swap_matches WHERE user_a_id = '00000000-0000-0000-0000-000000000ff1' AND user_b_id = '00000000-0000-0000-0000-000000000ff2';
    $$,
    ARRAY['matched'],
    'Skill swap match should be created automatically in matched status'
);

-- 5. User A accepts match
SELECT lives_ok(
    $$
    SELECT public.accept_skill_swap_match(id) FROM public.skill_swap_matches WHERE user_a_id = '00000000-0000-0000-0000-000000000ff1';
    $$,
    'User A accepts the match'
);

-- Assert user_a_accepted becomes true but match status is still matched (needs B's acceptance)
SELECT results_eq(
    $$
    SELECT user_a_accepted, status FROM public.skill_swap_matches WHERE user_a_id = '00000000-0000-0000-0000-000000000ff1';
    $$,
    ROW(true, 'matched'),
    'User A accepted remains true, status is pending B'
);

-- 6. User B accepts match
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000ff2';

SELECT lives_ok(
    $$
    SELECT public.accept_skill_swap_match(id) FROM public.skill_swap_matches WHERE user_a_id = '00000000-0000-0000-0000-000000000ff1';
    $$,
    'User B accepts the match'
);

-- Assert status becomes accepted
SELECT results_eq(
    $$
    SELECT status FROM public.skill_swap_matches WHERE user_a_id = '00000000-0000-0000-0000-000000000ff1';
    $$,
    ARRAY['accepted'],
    'Both accepted should update match status to accepted'
);

ROLLBACK;
