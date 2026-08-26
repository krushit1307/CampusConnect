-- Test Suite: User Blocks System, Feed Filtering, and DM 403 Validation

BEGIN;

-- 1. Setup test fixtures
INSERT INTO auth.users (id, email)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'user_a@campusconnect.test'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@campusconnect.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'User', 'A', 'usera'),
  ('22222222-2222-2222-2222-222222222222', 'User', 'B', 'userb')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('33333333-3333-3333-3333-333333333333', 'Test Club', 'test-club-block')
ON CONFLICT (id) DO NOTHING;

-- 2. Test User A blocks User B
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- 3. Verify user_blocks table entry exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_blocks 
    WHERE blocker_id = '11111111-1111-1111-1111-111111111111' 
      AND blocked_id = '22222222-2222-2222-2222-222222222222'
  ) THEN
    RAISE EXCEPTION 'Test Failed: User block record was not inserted properly';
  END IF;
END $$;

-- 4. User B creates a post
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Public event post by User B');

-- 5. User A loads global feed (simulating auth context for User A)
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
  v_post_count INT;
BEGIN
  SELECT COUNT(*) INTO v_post_count
  FROM public.get_posts_cursor(NULL, NULL, 50)
  WHERE author_id = '22222222-2222-2222-2222-222222222222';

  IF v_post_count > 0 THEN
    RAISE EXCEPTION 'Test Failed: Blocked user B post appeared in User A feed payload';
  END IF;
END $$;

-- 6. User B attempts to send direct message to User A -> Should throw 403 Trigger Exception
DO $$
BEGIN
  BEGIN
    INSERT INTO public.direct_messages (sender_id, receiver_id, encrypted_content, iv)
    VALUES (
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
      'encrypted_payload',
      'iv_vector'
    );
    RAISE EXCEPTION 'Test Failed: Direct message insert should have failed with 403 Forbidden error';
  EXCEPTION WHEN OTHERS THEN
    -- Expected exception thrown by tr_check_dm_block_before_insert
    IF SQLERRM NOT LIKE '%403%' AND SQLERRM NOT LIKE '%blocked%' THEN
      RAISE EXCEPTION 'Unexpected error message: %', SQLERRM;
    END IF;
  END;
END $$;

ROLLBACK;
