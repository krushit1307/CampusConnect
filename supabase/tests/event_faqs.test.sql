BEGIN;

SELECT plan(8);

-- Test 1: Check table exists
SELECT has_table('public', 'event_faqs', 'Table event_faqs should exist');

-- Test 2: Check columns
SELECT has_column('public', 'event_faqs', 'question', 'Should have question column');
SELECT has_column('public', 'event_faqs', 'answer', 'Should have answer column');
SELECT has_column('public', 'event_faqs', 'is_anonymous', 'Should have is_anonymous column');
SELECT has_column('public', 'event_faqs', 'is_published', 'Should have is_published column');

-- Test 3: Check RPC for getting public FAQs
SELECT has_function('public', 'get_public_event_faqs', 'Function get_public_event_faqs should exist');

-- Test 4: Check RPC for duplicate detection
SELECT has_function('public', 'find_similar_published_faqs', 'Function find_similar_published_faqs should exist');

-- Test 5: Verify trigger exists for updated_at
SELECT has_trigger('public', 'event_faqs', 'update_event_faqs_updated_at', 'Trigger for updated_at should exist on event_faqs');

ROLLBACK;
