-- Test suite: Smart Club Tag Recommendation Test
BEGIN;
SELECT plan(4);

-- Seed temporary tags for tests
INSERT INTO public.tag_ontology (id, name, parent_id)
VALUES
  ('00000000-0000-0000-0000-000000000021', 'Design', null),
  ('00000000-0000-0000-0000-000000000022', 'Graphic Design', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000023', 'Aviation', null);

SELECT has_function('public', 'suggest_ontology_tags', ARRAY['text[]'], 'suggest_ontology_tags helper function must be defined');

-- Test 1: Suggest exact match tags
SELECT results_eq(
    $$ SELECT public.suggest_ontology_tags(ARRAY['design', 'aviation']) $$,
    $$ VALUES ('["Aviation", "Design", "Graphic Design"]'::JSONB) $$,
    'Should correctly resolve exact matches and nested children'
);

-- Test 2: Suggest fuzzy similarity match tags
SELECT results_eq(
    $$ SELECT public.suggest_ontology_tags(ARRAY['desgn']) $$,
    $$ VALUES ('["Design", "Graphic Design"]'::JSONB) $$,
    'Should correctly identify spelling errors and match close similarity tags (fuzzy)'
);

-- Test 3: Suggest empty array on mismatch keywords
SELECT results_eq(
    $$ SELECT public.suggest_ontology_tags(ARRAY['unrelatedxyz']) $$,
    $$ VALUES ('[]'::JSONB) $$,
    'Should return empty array when no matches fit the criteria'
);

SELECT * FROM finish();
ROLLBACK;
