-- Migration: 20260731220000_polymorphic_likes.sql
-- Description: Create polymorphic likes table, migrate existing post_likes and event_likes data, drop old tables, and set up auto-populating club_id and cascade deletes.

-- 1. Create the entity type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'like_entity_type') THEN
    CREATE TYPE like_entity_type AS ENUM ('event', 'post', 'comment');
  END IF;
END $$;

-- 2. Create the generic likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type like_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  club_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id, club_id),
  CONSTRAINT likes_user_entity_unique UNIQUE (user_id, entity_type, entity_id, club_id)
);

-- 3. Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Anyone can read likes." ON public.likes;
CREATE POLICY "Anyone can read likes." 
ON public.likes FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert their own likes." ON public.likes;
CREATE POLICY "Users can insert their own likes." 
ON public.likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own likes." ON public.likes;
CREATE POLICY "Users can delete their own likes." 
ON public.likes FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Auto-population function and trigger for club_id
CREATE OR REPLACE FUNCTION public.fn_populate_likes_club_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    IF NEW.entity_type = 'event' THEN
      SELECT club_id INTO NEW.club_id FROM public.events WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'post' THEN
      SELECT club_id INTO NEW.club_id FROM public.posts WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'comment' THEN
      SELECT club_id INTO NEW.club_id FROM public.comments WHERE id = NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_likes_club_id ON public.likes;
CREATE TRIGGER trg_populate_likes_club_id
  BEFORE INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_populate_likes_club_id();

-- 6. Distribute the likes table across worker shards (Citus)
SELECT create_distributed_table('public.likes', 'club_id');

-- 7. Migrate existing post_likes data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_likes') THEN
    INSERT INTO public.likes (user_id, entity_type, entity_id, club_id, created_at)
    SELECT user_id, 'post'::like_entity_type, post_id, club_id, created_at FROM public.post_likes
    ON CONFLICT (user_id, entity_type, entity_id, club_id) DO NOTHING;
  END IF;
END $$;

-- 8. Migrate existing event_likes data (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_likes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_likes' AND column_name = 'club_id') THEN
      INSERT INTO public.likes (user_id, entity_type, entity_id, club_id, created_at)
      SELECT user_id, 'event'::like_entity_type, event_id, club_id, created_at FROM public.event_likes
      ON CONFLICT (user_id, entity_type, entity_id, club_id) DO NOTHING;
    ELSE
      INSERT INTO public.likes (user_id, entity_type, entity_id, created_at)
      SELECT user_id, 'event'::like_entity_type, event_id, created_at FROM public.event_likes
      ON CONFLICT (user_id, entity_type, entity_id, club_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 9. Drop the old post_likes and event_likes tables and triggers
DROP TRIGGER IF EXISTS trg_post_likes_insert ON public.post_likes CASCADE;
DROP TRIGGER IF EXISTS trg_post_likes_delete ON public.post_likes CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.event_likes CASCADE;

-- 10. Recreate update_post_like_count function to query the new generic likes table
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
    v_post_id := COALESCE(NEW.entity_id, OLD.entity_id);
  ELSE
    v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  END IF;

  UPDATE posts
  SET like_count = (
    (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id) +
    (SELECT COUNT(*) FROM likes WHERE entity_type = 'post' AND entity_id = v_post_id)
  )
  WHERE id = v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 11. Create likes triggers for posts like_count synchronization
DROP TRIGGER IF EXISTS trg_likes_insert ON public.likes;
CREATE TRIGGER trg_likes_insert
AFTER INSERT ON public.likes
FOR EACH ROW
WHEN (NEW.entity_type = 'post')
EXECUTE FUNCTION public.update_post_like_count();

DROP TRIGGER IF EXISTS trg_likes_delete ON public.likes;
CREATE TRIGGER trg_likes_delete
AFTER DELETE ON public.likes
FOR EACH ROW
WHEN (OLD.entity_type = 'post')
EXECUTE FUNCTION public.update_post_like_count();

-- 12. Update cascade_delete_post_relations
CREATE OR REPLACE FUNCTION public.cascade_delete_post_relations()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.comments WHERE post_id = OLD.id;
    DELETE FROM public.likes WHERE entity_type = 'post' AND entity_id = OLD.id;
    DELETE FROM public.post_reactions WHERE post_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 13. Create cascade deletes for events and comments
CREATE OR REPLACE FUNCTION public.cascade_delete_event_relations()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.likes WHERE entity_type = 'event' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_delete_event_relations ON public.events;
CREATE TRIGGER tr_cascade_delete_event_relations
AFTER DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_event_relations();

CREATE OR REPLACE FUNCTION public.cascade_delete_comment_relations()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.likes WHERE entity_type = 'comment' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cascade_delete_comment_relations ON public.comments;
CREATE TRIGGER tr_cascade_delete_comment_relations
AFTER DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_comment_relations();

-- 14. Redefine merge_user_accounts function to point to likes instead of post_likes
CREATE OR REPLACE FUNCTION public.merge_user_accounts(primary_id UUID, secondary_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the caller is authenticated as the primary user
    IF auth.uid() IS NULL OR auth.uid() != primary_id THEN
        RAISE EXCEPTION 'Unauthorized: Caller must be the primary user.';
    END IF;

    IF primary_id = secondary_id THEN
        RAISE EXCEPTION 'Cannot merge an account with itself.';
    END IF;

    -- Basic Updates (No UNIQUE user_id constraints)
    UPDATE public.clubs SET created_by = primary_id WHERE created_by = secondary_id;
    UPDATE public.clubs SET reviewed_by = primary_id WHERE reviewed_by = secondary_id;
    UPDATE public.events SET created_by = primary_id WHERE created_by = secondary_id;
    UPDATE public.posts SET author_id = primary_id WHERE author_id = secondary_id;
    UPDATE public.comments SET author_id = primary_id WHERE author_id = secondary_id;
    UPDATE public.certificates SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.notifications SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.audit_logs SET user_id = primary_id WHERE user_id = secondary_id;
    UPDATE public.event_attendance_logs SET recorded_by = primary_id WHERE recorded_by = secondary_id;
    UPDATE public.handle_history SET profile_id = primary_id WHERE profile_id = secondary_id;

    -- Updates with ON CONFLICT DO NOTHING (Tables with UNIQUE constraints)
    
    -- 1. club_members (UNIQUE: club_id, user_id)
    UPDATE public.club_members SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (club_id, user_id) DO NOTHING;

    -- 2. event_rsvps (UNIQUE: event_id, user_id)
    UPDATE public.event_rsvps SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 3. saved_events (UNIQUE: event_id, user_id)
    UPDATE public.saved_events SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 4. post_reactions (UNIQUE: post_id, user_id, emoji)
    UPDATE public.post_reactions SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (post_id, user_id, emoji) DO NOTHING;

    -- 5. profile_achievements (UNIQUE: profile_id, achievement_id)
    UPDATE public.profile_achievements SET profile_id = primary_id WHERE profile_id = secondary_id
    ON CONFLICT (profile_id, achievement_id) DO NOTHING;

    -- 6. event_waitlist (UNIQUE: event_id, user_id)
    UPDATE public.event_waitlist SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 7. event_feedbacks (UNIQUE: event_id, user_id)
    UPDATE public.event_feedbacks SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- 8. daily_active_users (UNIQUE: user_id, activity_date)
    UPDATE public.daily_active_users SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (user_id, activity_date) DO NOTHING;

    -- 9. likes (UNIQUE: user_id, entity_type, entity_id, club_id)
    UPDATE public.likes SET user_id = primary_id WHERE user_id = secondary_id
    ON CONFLICT (user_id, entity_type, entity_id, club_id) DO NOTHING;

    -- 10. reports (UNIQUE: reporter_id, target_type, target_id)
    UPDATE public.reports SET reporter_id = primary_id WHERE reporter_id = secondary_id
    ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING;

    -- Delete the secondary profile
    DELETE FROM public.profiles WHERE id = secondary_id;

END;
$$;
