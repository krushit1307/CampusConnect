-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(4);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create a test user in auth.users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000601', 'eventsearcher@test.com', 'authenticated', 'authenticated', '{"full_name": "Event Searcher"}')
ON CONFLICT (id) DO NOTHING;

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000602', 'Search Club', 'search-club', 'A club for testing searches', '90000000-0000-0000-0000-000000000601')
ON CONFLICT (id) DO NOTHING;

-- Create events
INSERT INTO public.events (id, club_id, title, description, tags, location, created_by, event_date)
VALUES 
  ('90000000-0000-0000-0000-000000000603', '90000000-0000-0000-0000-000000000602', 'Intro to JavaScript Workshop', 'Learn basic web development and programming concepts.', ARRAY['js', 'webdev', 'coding'], 'Room A', '90000000-0000-0000-0000-000000000601', NOW() + INTERVAL '1 day'),
  ('90000000-0000-0000-0000-000000000604', '90000000-0000-0000-0000-000000000602', 'Watercolor Art Workshop', 'Create beautiful paintings with watercolours. Bring your own brushes.', ARRAY['art', 'watercolor', 'painting'], 'Room B', '90000000-0000-0000-0000-000000000601', NOW() + INTERVAL '2 days'),
  ('90000000-0000-0000-0000-000000000605', '90000000-0000-0000-0000-000000000602', 'Advanced Algorithms Seminar', 'A deep dive into complex graph algorithms and coding optimizations.', ARRAY['coding', 'algorithms', 'computer-science'], 'Room C', '90000000-0000-0000-0000-000000000601', NOW() + INTERVAL '3 days');


-- ==========================================
-- Test Case 1: Search by title works and returns matching events
-- ==========================================
SELECT results_eq(
  $$SELECT title FROM public.search_events('JavaScript')$$,
  $$VALUES ('Intro to JavaScript Workshop'::text)$$,
  'Should find events by title keyword JavaScript'
);

-- ==========================================
-- Test Case 2: Search by description works
-- ==========================================
SELECT results_eq(
  $$SELECT title FROM public.search_events('paintings')$$,
  $$VALUES ('Watercolor Art Workshop'::text)$$,
  'Should find events by description keyword paintings'
);

-- ==========================================
-- Test Case 3: Search by tag works
-- ==========================================
SELECT set_eq(
  $$SELECT title FROM public.search_events('coding')$$,
  $$VALUES 
    ('Intro to JavaScript Workshop'::text),
    ('Advanced Algorithms Seminar'::text)
  $$,
  'Should retrieve events tagged with coding'
);

-- ==========================================
-- Test Case 4: Title match ranks higher than tag/description match
-- ==========================================
-- Searching for "algorithms" should return "Advanced Algorithms Seminar" first.
-- Searching for "watercolor" should return "Watercolor Art Workshop" first.
SELECT results_eq(
  $$SELECT title FROM public.search_events('algorithms')$$ ,
  $$VALUES ('Advanced Algorithms Seminar'::text)$$,
  'Should find event matching algorithms'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
