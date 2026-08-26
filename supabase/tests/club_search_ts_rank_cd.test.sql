-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(3);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000701', 'clubsearcher@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Searcher"}')
ON CONFLICT (id) DO NOTHING;

-- Club A: "Computer Science Society" (title matches "Computer Science" closely)
-- Club B: "Cooking Club" (title doesn't match, description has words "computer" and "science" far apart)
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES 
  ('90000000-0000-0000-0000-000000000702', 'Computer Science Society', 'cs-society', 'Official student society for computing and software engineering.', '90000000-0000-0000-0000-000000000701'),
  ('90000000-0000-0000-0000-000000000703', 'Cooking Club', 'cooking-club', 'We use a computer to look up recipes and learn the science of culinary baking.', '90000000-0000-0000-0000-000000000701')
ON CONFLICT (id) DO NOTHING;

-- Test Case 1: Search for "Computer Science" returns Computer Science Society as #1 result
SELECT results_eq(
  $$SELECT name FROM public.search_clubs('Computer Science') LIMIT 1$$,
  $$VALUES ('Computer Science Society'::text)$$,
  'Cover density ts_rank_cd ranking should place Computer Science Society as #1 result'
);

-- Test Case 2: Exact/close title match ranks higher than sparse description match
SELECT results_eq(
  $$SELECT name FROM public.search_clubs('Computer Science')$$,
  $$VALUES 
    ('Computer Science Society'::text),
    ('Cooking Club'::text)
  $$,
  'Should return Computer Science Society ahead of Cooking Club'
);

-- Test Case 3: Title setweight prioritization test
SELECT results_eq(
  $$SELECT name FROM public.search_clubs('Cooking') LIMIT 1$$,
  $$VALUES ('Cooking Club'::text)$$,
  'Should return Cooking Club when searching for Cooking'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
