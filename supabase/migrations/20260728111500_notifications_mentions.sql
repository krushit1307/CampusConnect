-- Migration: Add Mentions table, auto-extraction triggers, and query/update RPCs

-- 1. Create mentions table
CREATE TABLE IF NOT EXISTS public.mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create index for fast user scans
CREATE INDEX IF NOT EXISTS idx_mentions_user_id ON public.mentions (user_id);

-- 3. Enable RLS
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Users can view their own mentions." ON public.mentions;
CREATE POLICY "Users can view their own mentions." 
ON public.mentions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mentions." ON public.mentions;
CREATE POLICY "Users can update their own mentions." 
ON public.mentions FOR UPDATE 
USING (auth.uid() = user_id);

-- 5. Create trigger function to automatically extract mentions from post/comment content
CREATE OR REPLACE FUNCTION public.parse_mentions_from_content()
RETURNS TRIGGER AS $$
DECLARE
    tag_handle TEXT;
    target_user_id UUID;
BEGIN
    -- Extract all matches of @username
    FOR tag_handle IN 
        SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_]+)', 'g'))[1]
    LOOP
        -- Find user by handle (case-insensitive)
        SELECT id INTO target_user_id 
        FROM public.profiles 
        WHERE LOWER(handle) = LOWER(tag_handle);

        -- If target user exists and is not the author, insert mention
        IF target_user_id IS NOT NULL AND target_user_id != NEW.author_id THEN
            IF TG_TABLE_NAME = 'posts' THEN
                INSERT INTO public.mentions (user_id, post_id)
                VALUES (target_user_id, NEW.id)
                ON CONFLICT DO NOTHING;
            ELSIF TG_TABLE_NAME = 'comments' THEN
                INSERT INTO public.mentions (user_id, post_id, comment_id)
                VALUES (target_user_id, NEW.post_id, NEW.id)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bind triggers to posts and comments
DROP TRIGGER IF EXISTS tr_parse_mentions_on_post ON public.posts;
CREATE TRIGGER tr_parse_mentions_on_post
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.parse_mentions_from_content();

DROP TRIGGER IF EXISTS tr_parse_mentions_on_comment ON public.comments;
CREATE TRIGGER tr_parse_mentions_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.parse_mentions_from_content();

-- 7. Create get_user_mentions function
CREATE OR REPLACE FUNCTION public.get_user_mentions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    message TEXT,
    link TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    m.id,
    'mention'::TEXT AS type,
    CASE 
      WHEN m.comment_id IS NOT NULL THEN 'Mentioned in Comment'
      ELSE 'Mentioned in Post'
    END AS title,
    CASE 
      WHEN m.comment_id IS NOT NULL THEN COALESCE(p_author.first_name || ' ' || p_author.last_name, 'Someone') || ' mentioned you in a comment.'
      ELSE COALESCE(p_author.first_name || ' ' || p_author.last_name, 'Someone') || ' mentioned you in a post.'
    END AS message,
    CASE 
      WHEN m.comment_id IS NOT NULL THEN '/feed'
      ELSE '/feed'
    END AS link,
    m.is_read,
    m.created_at
  FROM public.mentions m
  LEFT JOIN public.posts p ON p.id = m.post_id
  LEFT JOIN public.comments c ON c.id = m.comment_id
  LEFT JOIN public.profiles p_author ON p_author.id = COALESCE(c.author_id, p.author_id)
  WHERE m.user_id = p_user_id
  ORDER BY m.created_at DESC;
$$;

-- 8. Create mark_mention_as_read function
CREATE OR REPLACE FUNCTION public.mark_mention_as_read(p_mention_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.mentions
    SET is_read = TRUE
    WHERE id = p_mention_id AND user_id = p_user_id;
END;
$$;

-- 9. Create mark_all_mentions_as_read function
CREATE OR REPLACE FUNCTION public.mark_all_mentions_as_read(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.mentions
    SET is_read = TRUE
    WHERE user_id = p_user_id;
END;
$$;

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_mentions(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_mention_as_read(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_mentions_as_read(UUID) TO authenticated, anon;
