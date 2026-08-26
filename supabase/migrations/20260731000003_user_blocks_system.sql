-- Migration: 20260731000000_user_blocks_system.sql
-- Description: Implement server-side Mute/Block system filtering global feeds, comments, and direct messages.

-- 1. Create user_blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT check_no_self_block CHECK (blocker_id <> blocked_id)
);

-- 2. Indexes for performance on high-volume relational filtering
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks(blocked_id);

-- 3. Row Level Security (RLS) for user_blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blocked list" ON public.user_blocks;
CREATE POLICY "Users can view their own blocked list" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block accounts" ON public.user_blocks;
CREATE POLICY "Users can block accounts" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can unblock accounts" ON public.user_blocks;
CREATE POLICY "Users can unblock accounts" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- 4. Helper function: check if blocker has blocked user
CREATE OR REPLACE FUNCTION public.is_user_blocked(p_blocker_id UUID, p_blocked_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = p_blocker_id AND blocked_id = p_blocked_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_blocked(UUID, UUID) TO authenticated;

-- 5. RPC Function: Fetch blocked user details for Settings management
CREATE OR REPLACE FUNCTION public.get_blocked_users(p_user_id UUID)
RETURNS TABLE (
  blocked_id UUID,
  first_name TEXT,
  last_name TEXT,
  handle TEXT,
  avatar_url TEXT,
  college TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ub.blocked_id,
    p.first_name,
    p.last_name,
    p.handle,
    p.avatar_url,
    p.college,
    ub.created_at
  FROM public.user_blocks ub
  JOIN public.profiles p ON p.id = ub.blocked_id
  WHERE ub.blocker_id = p_user_id
  ORDER BY ub.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_users(UUID) TO authenticated;

-- 6. Update get_posts_cursor RPC function to filter out posts from blocked users
CREATE OR REPLACE FUNCTION public.get_posts_cursor(
    last_created_at TIMESTAMPTZ,
    last_id UUID,
    fetch_limit INT DEFAULT 10
)
RETURNS SETOF public.posts
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.posts
    WHERE deleted_at IS NULL
      AND (
        auth.uid() IS NULL 
        OR author_id NOT IN (
          SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
        )
      )
      AND (
        last_created_at IS NULL 
        OR last_id IS NULL 
        OR (created_at, id) < (last_created_at, last_id)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT fetch_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posts_cursor(TIMESTAMPTZ, UUID, INT) TO authenticated, anon, service_role;

-- 7. Trigger to prevent direct message insertion if receiver has blocked sender
CREATE OR REPLACE FUNCTION public.check_dm_block_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks 
    WHERE blocker_id = NEW.receiver_id AND blocked_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION '403: Receiver has blocked the sender' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks 
    WHERE blocker_id = NEW.sender_id AND blocked_id = NEW.receiver_id
  ) THEN
    RAISE EXCEPTION '403: Sender has blocked the receiver' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_dm_block_before_insert ON public.direct_messages;
CREATE TRIGGER tr_check_dm_block_before_insert
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.check_dm_block_before_insert();

-- 8. Apply RLS filtering to posts, comments, and direct_messages
DROP POLICY IF EXISTS "Filter posts from blocked accounts" ON public.posts;
CREATE POLICY "Filter posts from blocked accounts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    author_id NOT IN (
      SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Filter comments from blocked accounts" ON public.comments;
CREATE POLICY "Filter comments from blocked accounts" ON public.comments
  FOR SELECT TO authenticated
  USING (
    author_id NOT IN (
      SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Filter direct messages from blocked relationships" ON public.direct_messages;
CREATE POLICY "Filter direct messages from blocked relationships" ON public.direct_messages
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND sender_id NOT IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid())
    AND receiver_id NOT IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid())
  );
