-- Migration: 20260729130000_realtime_posts_delete_broadcast.sql
-- Issue: #1297
-- Description: Enable Realtime broadcast for post deletion events on public.posts

-- Set REPLICA IDENTITY FULL so DELETE events include the full row (including id)
ALTER TABLE public.posts REPLICA IDENTITY FULL;

-- Ensure public.posts is published to supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
END $$;
