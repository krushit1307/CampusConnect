-- Migration: Implement Database-level Comment Rate Limiter Trigger
-- Restricts users to a maximum of 5 comments per minute.

CREATE OR REPLACE FUNCTION public.check_comment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_count INTEGER;
BEGIN
  -- Count comments created by the currently authenticated user in the past 60 seconds
  SELECT COUNT(*)
  INTO v_comment_count
  FROM public.comments
  WHERE author_id = auth.uid()
    AND created_at >= NOW() - INTERVAL '1 minute';

  -- Abort insert if count is >= 5
  IF v_comment_count >= 5 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded. You can only post 5 comments per minute.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Apply BEFORE INSERT trigger on the comments table
CREATE OR REPLACE TRIGGER before_comment_insert
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.check_comment_rate_limit();
