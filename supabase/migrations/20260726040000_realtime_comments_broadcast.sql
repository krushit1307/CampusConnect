-- ============================================================
-- Migration: 20260726040000_realtime_comments_broadcast.sql
-- Issue: #1237
-- Description:
--   Ensures public.comments is published to the supabase_realtime
--   publication so that INSERT events can be broadcast via WebSockets.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;
END $$;
