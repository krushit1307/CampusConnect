-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create two test users in auth.users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000401', 'sender@test.com', 'authenticated', 'authenticated', '{"full_name": "Sender User"}'),
  ('90000000-0000-0000-0000-000000000402', 'recipient@test.com', 'authenticated', 'authenticated', '{"full_name": "Recipient User"}')
ON CONFLICT (id) DO NOTHING;

-- Populate their profiles
UPDATE public.profiles SET handle = 'sender_user', full_name = 'Sender User' WHERE id = '90000000-0000-0000-0000-000000000401';
UPDATE public.profiles SET handle = 'recipient_user', full_name = 'Recipient User' WHERE id = '90000000-0000-0000-0000-000000000402';

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000403', 'Mentions Club', 'mentions-club', 'A club for testing mentions', '90000000-0000-0000-0000-000000000401')
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- Test Case 1: Insert post mentioning @recipient_user
-- ==========================================
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES (
  '90000000-0000-0000-0000-000000000404',
  '90000000-0000-0000-0000-000000000403',
  '90000000-0000-0000-0000-000000000401',
  'Hey @recipient_user check this out!'
);

SELECT ok(
  EXISTS(SELECT 1 FROM public.mentions WHERE user_id = '90000000-0000-0000-0000-000000000402' AND post_id = '90000000-0000-0000-0000-000000000404'),
  'Inserting post with @handle should trigger auto-creation of a mention'
);

-- ==========================================
-- Test Case 2: Query mentions via get_user_mentions
-- ==========================================
SELECT results_eq(
  $$SELECT title, message, is_read FROM public.get_user_mentions('90000000-0000-0000-0000-000000000402')$$ ,
  $$VALUES ('Mentioned in Post', 'Sender User mentioned you in a post.', FALSE)$$,
  'get_user_mentions should return correctly formatted mention notifications'
);

-- ==========================================
-- Test Case 3: Insert comment mentioning @recipient_user
-- ==========================================
INSERT INTO public.comments (id, post_id, author_id, content)
VALUES (
  '90000000-0000-0000-0000-000000000405',
  '90000000-0000-0000-0000-000000000404',
  '90000000-0000-0000-0000-000000000401',
  'I agree with @recipient_user!'
);

SELECT ok(
  EXISTS(SELECT 1 FROM public.mentions WHERE user_id = '90000000-0000-0000-0000-000000000402' AND comment_id = '90000000-0000-0000-0000-000000000405'),
  'Inserting comment with @handle should trigger auto-creation of a mention'
);

-- ==========================================
-- Test Case 4: get_user_mentions should list both post and comment mentions
-- ==========================================
SELECT results_eq(
  $$SELECT title FROM public.get_user_mentions('90000000-0000-0000-0000-000000000402')$$ ,
  $$VALUES ('Mentioned in Comment'), ('Mentioned in Post')$$,
  'get_user_mentions should return post and comment mentions ordered by created_at DESC'
);

-- ==========================================
-- Test Case 5: Mark single mention as read
-- ==========================================
SELECT lives_ok(
  $$SELECT public.mark_mention_as_read('90000000-0000-0000-0000-000000000405', '90000000-0000-0000-0000-000000000402')$$,
  'Should successfully execute mark_mention_as_read'
);

SELECT results_eq(
  $$SELECT is_read FROM public.mentions WHERE id = '90000000-0000-0000-0000-000000000405'$$,
  $$VALUES (TRUE)$$,
  'Mention is_read flag should be set to true'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
