-- ============================================================
-- Test Suite: live_qa_upvoting.test.sql
-- Description: Verifies event_questions upvoting column, question_votes junction table, and atomic voting RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schema components
SELECT has_column('public', 'event_questions', 'upvotes_count', 'event_questions table should have upvotes_count column');
SELECT col_type_is('public', 'event_questions', 'upvotes_count', 'integer', 'event_questions.upvotes_count should be of type integer');

SELECT has_table('public', 'question_votes', 'question_votes table should exist');
SELECT has_pk('public', 'question_votes', 'question_votes should have a primary key constraint');

SELECT has_function('public', 'toggle_question_vote', ARRAY['uuid'], 'toggle_question_vote function should exist');

-- 2. Mock users, club, event, and questions
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000bb1', 'voter@campus.edu'),
    ('00000000-0000-0000-0000-000000000bb2', 'author@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000bb1', 'Valerie', 'Voter', 'valerie_voter', 'voter@campus.edu'),
    ('00000000-0000-0000-0000-000000000bb2', 'Arthur', 'Author', 'arthur_author', 'author@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000bc1',
    'Q&A Club',
    'qa-club',
    '00000000-0000-0000-0000-000000000bb2'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000be1',
    '00000000-0000-0000-0000-000000000bc1',
    'Live Q&A Seminar',
    'published',
    now() + INTERVAL '2 hours',
    now() + INTERVAL '4 hours',
    '00000000-0000-0000-0000-000000000bb2'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_questions (id, event_id, user_id, question, status)
VALUES (
    '00000000-0000-0000-0000-000000000bq1',
    '00000000-0000-0000-0000-000000000be1',
    '00000000-0000-0000-0000-000000000bb2',
    'What are the core scaling constraints for Supabase Realtime?',
    'queued'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Execute toggle upvote as voter user
-- Set authenticated user ID context
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000bb1"}', true);

-- Call upvote
SELECT results_eq(
    $$
    SELECT public.toggle_question_vote('00000000-0000-0000-0000-000000000bq1');
    $$,
    ARRAY[1],
    'First vote call should return 1 upvote'
);

-- Assert DB records updated
SELECT results_eq(
    $$
    SELECT upvotes_count FROM public.event_questions WHERE id = '00000000-0000-0000-0000-000000000bq1';
    $$,
    ARRAY[1],
    'event_questions.upvotes_count should be updated to 1'
);

-- Call again to downvote/toggle off
SELECT results_eq(
    $$
    SELECT public.toggle_question_vote('00000000-0000-0000-0000-000000000bq1');
    $$,
    ARRAY[0],
    'Second vote call should toggle off and return 0 upvotes'
);

ROLLBACK;
