-- Start transaction
BEGIN;

-- Enable pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(3);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000801', 'clubfuzzysearcher@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Searcher"}')
ON CONFLICT (id) DO NOTHING;

-- Setup test clubs
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES 
  ('90000000-0000-0000-0000-000000000802', 'Computer Engineering Society', 'comp-eng-society', 'Official society for computer engineers.', '90000000-0000-0000-0000-000000000801'),
  ('90000000-0000-0000-0000-000000000803', 'Fine Arts Club', 'arts-club', 'Sketching, painting, and drawing club.', '90000000-0000-0000-0000-000000000801'),
  ('90000000-0000-0000-0000-000000000804', 'Earth and Science Club', 'earth-science-club', 'Exploring earth science concepts.', '90000000-0000-0000-0000-000000000801')
ON CONFLICT (id) DO NOTHING;

-- Test Case 1: Search for "Cmputer Enginering" (multiple typos) returns Computer Engineering Society
SELECT results_eq(
  $$SELECT name FROM public.search_clubs('Cmputer Enginering') LIMIT 1$$,
  $$VALUES ('Computer Engineering Society'::text)$$,
  'Fuzzy search should match Computer Engineering Society even with severe typos'
);

-- Test Case 2: Short search for "Art" matches Fine Arts Club
SELECT results_eq(
  $$SELECT name FROM public.search_clubs('Art') LIMIT 1$$,
  $$VALUES ('Fine Arts Club'::text)$$,
  'Short search query should resolve to Fine Arts Club'
);

-- Test Case 3: Short search for "Art" does not pull in totally unrelated clubs like Earth and Science Club (despite matching "Earth" trigrams)
SELECT is_empty(
  $$SELECT name FROM public.search_clubs('Art') WHERE name = 'Earth and Science Club'$$,
  'Short query bypasses trigram matching to avoid matching Earth and Science Club'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
