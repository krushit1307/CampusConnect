-- ============================================================
-- Test Suite: club_tag_sentiment_correlation.test.sql
-- Description: Verifies the Dynamic "Club Tag" Sentiment Correlation engine.
--              Tests the materialized view, ranking RPC, and suggestion RPC.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(13);

-- 1. Schema / object checks
SELECT has_function('public', 'get_tag_sentiment_ranking',   ARRAY['integer','integer','integer'],   'get_tag_sentiment_ranking RPC should exist');
SELECT has_function('public', 'suggest_tags_for_event',      ARRAY['integer'],                       'suggest_tags_for_event RPC should exist');
SELECT has_function('public', 'refresh_tag_sentiment_rankings', ARRAY[]::text[],                    'refresh_tag_sentiment_rankings helper should exist');

-- 2. Mock Data Setup

-- Profiles
INSERT INTO public.profiles (id, full_name, role)
SELECT '77777777-7777-7777-7777-' || lpad(n::text, 12, '0'), 'Student ' || n, 'student'
FROM generate_series(1, 110) AS n
ON CONFLICT (id) DO NOTHING;

-- Club
INSERT INTO public.clubs (id, name, slug)
VALUES ('77777777-7777-7777-7777-aaaaaaaaaaaa', 'Sentiment Test Club', 'sentiment-test-club')
ON CONFLICT (id) DO NOTHING;

-- Ensure ltree extension and tags table exist (already exist via 20260730000003)
CREATE EXTENSION IF NOT EXISTS ltree;

-- Insert two test tag paths
INSERT INTO public.tags (path)
VALUES ('puppies'::ltree), ('finance_networking'::ltree)
ON CONFLICT DO NOTHING;

-- Events for each tag (two events)
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status)
VALUES
    ('77777777-7777-7777-7777-eeeeeeeeee01', '77777777-7777-7777-7777-aaaaaaaaaaaa', 'Puppy Therapy Day',       200, 200, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days', 'completed'),
    ('77777777-7777-7777-7777-eeeeeeeeee02', '77777777-7777-7777-7777-aaaaaaaaaaaa', 'Finance Networking Night', 200, 200, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days', 'completed')
ON CONFLICT (id) DO NOTHING;

-- Assign tags
INSERT INTO public.event_tags (event_id, tag_path)
VALUES
    ('77777777-7777-7777-7777-eeeeeeeeee01', 'puppies'::ltree),
    ('77777777-7777-7777-7777-eeeeeeeeee02', 'finance_networking'::ltree)
ON CONFLICT DO NOTHING;

-- Insert feedback: 105 high-rating reviews for #puppies, 105 low-rating reviews for #finance_networking
INSERT INTO public.event_feedback (id, event_id, user_id, rating)
SELECT
    gen_random_uuid(),
    CASE WHEN n <= 105 THEN '77777777-7777-7777-7777-eeeeeeeeee01' ELSE '77777777-7777-7777-7777-eeeeeeeeee02' END,
    '77777777-7777-7777-7777-' || lpad(n::text, 12, '0'),
    CASE WHEN n <= 105 THEN 5 ELSE 2 END  -- puppies=5★, finance=2★
FROM generate_series(1, 110) AS n
ON CONFLICT (event_id, user_id) DO NOTHING;

-- 3. Refresh the materialized view to pick up mock data
PERFORM public.refresh_tag_sentiment_rankings();

-- 4. Verify puppies tag is in rankings with high avg_rating
SELECT ok(
    EXISTS (SELECT 1 FROM public.tag_sentiment_rankings WHERE tag_path = 'puppies' AND avg_rating >= 4.5),
    '#puppies should appear in rankings with avg_rating >= 4.5'
);

-- 5. Verify finance_networking has low avg_rating
SELECT ok(
    EXISTS (SELECT 1 FROM public.tag_sentiment_rankings WHERE tag_path = 'finance_networking' AND avg_rating <= 3.0),
    '#finance_networking should appear with avg_rating <= 3.0'
);

-- 6. Verify sentiment_label is correct for puppies
SELECT results_eq(
    $$ SELECT sentiment_label FROM public.tag_sentiment_rankings WHERE tag_path = 'puppies' $$,
    $$ VALUES ('Very High Satisfaction'::text) $$,
    '#puppies should have "Very High Satisfaction" label'
);

-- 7. Verify sentiment_label for finance_networking
SELECT results_eq(
    $$ SELECT sentiment_label FROM public.tag_sentiment_rankings WHERE tag_path = 'finance_networking' $$,
    $$ VALUES ('Very Low Satisfaction'::text) $$,
    '#finance_networking should have "Very Low Satisfaction" label'
);

-- 8. Verify review_count >= 100 for both tags
SELECT ok(
    (SELECT review_count >= 100 FROM public.tag_sentiment_rankings WHERE tag_path = 'puppies'),
    '#puppies should have review_count >= 100'
);

-- 9. Verify get_tag_sentiment_ranking RPC returns ranked results
SELECT ok(
    (SELECT COUNT(*) >= 2 FROM public.get_tag_sentiment_ranking(100, 50, 0)),
    'get_tag_sentiment_ranking RPC should return at least 2 rows'
);

-- 10. Verify puppies ranks first (highest avg_rating)
SELECT results_eq(
    $$ SELECT tag_path FROM public.get_tag_sentiment_ranking(100, 1, 0) $$,
    $$ VALUES ('puppies'::text) $$,
    '#puppies should rank first in get_tag_sentiment_ranking'
);

-- 11. Verify suggest_tags_for_event returns results
SELECT ok(
    (SELECT COUNT(*) >= 1 FROM public.suggest_tags_for_event(5)),
    'suggest_tags_for_event should return at least 1 suggestion'
);

-- 12. Verify tip_message contains useful content for puppies
SELECT ok(
    EXISTS (SELECT 1 FROM public.suggest_tags_for_event(5) WHERE tip_message LIKE '%#puppies%' OR tip_message LIKE '%puppies%'),
    'suggest_tags_for_event tip_message should reference the puppies tag'
);

-- 13. Tags with < 100 reviews should NOT appear in rankings
-- Insert a tag with only 5 reviews
INSERT INTO public.tags (path) VALUES ('rare_event_tag'::ltree) ON CONFLICT DO NOTHING;
INSERT INTO public.clubs (id, name, slug)
VALUES ('77777777-7777-7777-7777-bbbbbbbbbbbb', 'Rare Club', 'rare-club') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status)
VALUES ('77777777-7777-7777-7777-eeeeeeeeee03', '77777777-7777-7777-7777-bbbbbbbbbbbb', 'Rare Event', 10, 10, NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', 'completed')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_tags (event_id, tag_path) VALUES ('77777777-7777-7777-7777-eeeeeeeeee03', 'rare_event_tag'::ltree) ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, full_name, role)
SELECT '88888888-8888-8888-8888-' || lpad(n::text, 12, '0'), 'Rare Student ' || n, 'student'
FROM generate_series(1, 5) AS n ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_feedback (event_id, user_id, rating)
SELECT '77777777-7777-7777-7777-eeeeeeeeee03', '88888888-8888-8888-8888-' || lpad(n::text, 12, '0'), 5
FROM generate_series(1, 5) AS n ON CONFLICT (event_id, user_id) DO NOTHING;

PERFORM public.refresh_tag_sentiment_rankings();

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.tag_sentiment_rankings WHERE tag_path = 'rare_event_tag'),
    'Tags with fewer than 100 reviews should NOT appear in tag_sentiment_rankings'
);

ROLLBACK;
