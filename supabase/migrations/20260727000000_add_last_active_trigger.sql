-- ============================================================
-- Migration: 20260727000000_add_last_active_trigger.sql
-- Description:
-- Adds last_active_at timestamp to profiles and creates a reusable trigger
-- function to update it whenever a user creates/updates a post, comment, or RSVP.
-- ============================================================

-- 1. Add column to profiles (if not exists)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- 2. Create reusable trigger function
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the profile of the actor (author_id or user_id) to current timestamp
  UPDATE profiles
  SET last_active_at = NOW()
  WHERE id = COALESCE(NEW.author_id, NEW.user_id);
  RETURN NEW;
END;
$$;

-- 3. Attach triggers to relevant tables
-- Posts
DROP TRIGGER IF EXISTS trg_update_last_active_on_posts ON public.posts;
CREATE TRIGGER trg_update_last_active_on_posts
AFTER INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_last_active();

-- Comments (if comments table exists)
DROP TRIGGER IF EXISTS trg_update_last_active_on_comments ON public.comments;
CREATE TRIGGER trg_update_last_active_on_comments
AFTER INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_last_active();

-- Event RSVPs (assuming table name event_rsvps)
DROP TRIGGER IF EXISTS trg_update_last_active_on_event_rsvps ON public.event_rsvps;
CREATE TRIGGER trg_update_last_active_on_event_rsvps
AFTER INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.update_last_active();
