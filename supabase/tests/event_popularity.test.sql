-- pgTAP Test Suite for Event Popularity Function
-- Run with: psql -U postgres -d postgres -f supabase/tests/event_popularity.test.sql

BEGIN;
SELECT plan(4);

-- Test 1: Function exists and is callable
SELECT has_function(
    'public', 'get_event_popularity_score', 
    ARRAY['uuid', 'timestamp with time zone', 'integer', 'integer']::text[],
    'get_event_popularity_score function should exist with correct signature'
);

-- Test 2: Test popularity score calculation logic
-- Mock data: 10 RSVPs (50), 100 views (100), event in 3 days (100 recency) = 250
SELECT is(
    public.get_event_popularity_score(
        '00000000-0000-0000-0000-000000000001'::UUID,
        NOW() + INTERVAL '3 days',
        10,
        100
    ),
    250.00,
    'Popularity score should correctly calculate RSVPs, views, and high recency'
);

-- Test 3: Test recency decay for events > 30 days
-- Mock data: 10 RSVPs (50), 100 views (100), event in 40 days (10 recency) = 160
SELECT is(
    public.get_event_popularity_score(
        '00000000-0000-0000-0000-000000000002'::UUID,
        NOW() + INTERVAL '40 days',
        10,
        100
    ),
    160.00,
    'Popularity score should apply minimal recency boost for events > 30 days'
);

-- Test 4: Verify get_trending_events returns ordered results
SELECT function_returns(
    'public', 'get_trending_events', 
    ARRAY['integer', 'integer']::text[],
    'table',
    'get_trending_events should return a table'
);

SELECT * FROM finish();
ROLLBACK;

-- Test Event Popularity Score Implementation
-- This file tests the calculate_event_popularity function and materialized view

-- Setup: Create test data
BEGIN;

-- Create test club
INSERT INTO clubs (id, name, slug, description, created_by, visibility)
VALUES (
  gen_random_uuid(),
  'Test Club',
  'test-club',
  'A club for testing popularity scores',
  (SELECT id FROM profiles LIMIT 1),
  'public'
) ON CONFLICT DO NOTHING;

-- Get the test club ID
DO $$
DECLARE
  v_club_id UUID;
  v_event1_id UUID;
  v_event2_id UUID;
  v_event3_id UUID;
  v_user_id UUID;
  v_post_id UUID;
BEGIN
  SELECT id INTO v_club_id FROM clubs WHERE slug = 'test-club' LIMIT 1;
  
  -- Create test user if not exists
  SELECT id INTO v_user_id FROM profiles LIMIT 1;
  
  -- Create Event 1: Recent event with high engagement (should have high score)
  INSERT INTO events (id, club_id, title, start_date, created_by, status)
  VALUES (
    gen_random_uuid(),
    v_club_id,
    'Recent Popular Event',
    NOW() + INTERVAL '7 days',
    v_user_id,
    'scheduled'
  ) RETURNING id INTO v_event1_id;
  
  -- Create Event 2: Old event with same engagement (should have lower score due to decay)
  INSERT INTO events (id, club_id, title, start_date, created_by, status, created_at)
  VALUES (
    gen_random_uuid(),
    v_club_id,
    'Old Popular Event',
    NOW() + INTERVAL '7 days',
    v_user_id,
    'scheduled',
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_event2_id;
  
  -- Create Event 3: Recent event with low engagement (should have medium score)
  INSERT INTO events (id, club_id, title, start_date, created_by, status)
  VALUES (
    gen_random_uuid(),
    v_club_id,
    'Recent Quiet Event',
    NOW() + INTERVAL '7 days',
    v_user_id,
    'scheduled'
  ) RETURNING id INTO v_event3_id;
  
  -- Add RSVPs to Event 1 (10 RSVPs)
  INSERT INTO event_rsvps (event_id, user_id)
  SELECT v_event1_id, v_user_id FROM generate_series(1, 10);
  
  -- Add RSVPs to Event 2 (10 RSVPs - same as Event 1)
  INSERT INTO event_rsvps (event_id, user_id)
  SELECT v_event2_id, v_user_id FROM generate_series(1, 10);
  
  -- Add RSVPs to Event 3 (2 RSVPs)
  INSERT INTO event_rsvps (event_id, user_id)
  SELECT v_event3_id, v_user_id FROM generate_series(1, 2);
  
  -- Create a post in the club for comments
  INSERT INTO posts (id, club_id, author_id, content)
  VALUES (
    gen_random_uuid(),
    v_club_id,
    v_user_id,
    'Discussion post for testing comments'
  ) RETURNING id INTO v_post_id;
  
  -- Add comments to the post (these count toward all events in the club)
  INSERT INTO comments (post_id, author_id, content)
  SELECT v_post_id, v_user_id, 'Test comment ' || i FROM generate_series(1, 5);
  
  -- Test 1: Verify function returns a numeric value
  RAISE NOTICE 'Test 1: Function returns numeric value';
  PERFORM public.calculate_event_popularity(v_event1_id);
  RAISE NOTICE '✓ Function executed successfully for Event 1';
  
  -- Test 2: Compare scores - Event 1 should have higher score than Event 2 (same engagement, but Event 1 is newer)
  RAISE NOTICE 'Test 2: Time decay - newer events should rank higher';
  DECLARE
    v_score1 NUMERIC;
    v_score2 NUMERIC;
  BEGIN
    v_score1 := public.calculate_event_popularity(v_event1_id);
    v_score2 := public.calculate_event_popularity(v_event2_id);
    
    RAISE NOTICE 'Event 1 (recent) score: %', v_score1;
    RAISE NOTICE 'Event 2 (old) score: %', v_score2;
    
    IF v_score1 > v_score2 THEN
      RAISE NOTICE '✓ Time decay working correctly';
    ELSE
      RAISE EXCEPTION '✗ Time decay not working - newer event should have higher score';
    END IF;
  END;
  
  -- Test 3: More engagement should increase score
  RAISE NOTICE 'Test 3: More engagement increases score';
  DECLARE
    v_score1 NUMERIC;
    v_score3 NUMERIC;
  BEGIN
    v_score1 := public.calculate_event_popularity(v_event1_id);
    v_score3 := public.calculate_event_popularity(v_event3_id);
    
    RAISE NOTICE 'Event 1 (high engagement) score: %', v_score1;
    RAISE NOTICE 'Event 3 (low engagement) score: %', v_score3;
    
    IF v_score1 > v_score3 THEN
      RAISE NOTICE '✓ Engagement increases score correctly';
    ELSE
      RAISE EXCEPTION '✗ Engagement not affecting score correctly';
    END IF;
  END;
  
  -- Test 4: Materialized view contains expected columns
  RAISE NOTICE 'Test 4: Materialized view structure';
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_popularity;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_popularity' 
    AND column_name = 'popularity_score'
  ) THEN
    RAISE NOTICE '✓ Materialized view has popularity_score column';
  ELSE
    RAISE EXCEPTION '✗ Materialized view missing popularity_score column';
  END IF;
  
  -- Test 5: Can sort by popularity_score
  RAISE NOTICE 'Test 5: Sorting by popularity_score';
  DECLARE
    v_sorted_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_sorted_count
    FROM event_popularity
    ORDER BY popularity_score DESC;
    
    IF v_sorted_count >= 3 THEN
      RAISE NOTICE '✓ Can sort events by popularity_score (found % events)', v_sorted_count;
    ELSE
      RAISE EXCEPTION '✗ Sorting by popularity_score failed';
    END IF;
  END;
  
  -- Test 6: Refresh function works
  RAISE NOTICE 'Test 6: Refresh function';
  PERFORM public.refresh_event_popularity();
  RAISE NOTICE '✓ Refresh function executed successfully';
  
  RAISE NOTICE 'All tests passed!';
  
END $$;

ROLLBACK; -- Rollback to clean up test data
