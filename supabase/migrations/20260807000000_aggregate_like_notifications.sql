-- Migration: Aggregate Like Notifications
-- Timestamp: 20260807000000

-- 1. Modify notifications table schema
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS recent_actors UUID[] NOT NULL DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS group_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- 2. Create index on reference_id and type for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_reference_type_unread 
ON public.notifications(user_id, reference_id, type) 
WHERE is_read = FALSE;

-- 3. Define trigger function to handle aggregated like notifications
CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_actor_name TEXT;
  v_post_title TEXT;
  v_notif_id UUID;
  v_recent_actors UUID[];
  v_group_count INT;
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_link TEXT;
  v_metadata JSONB;
BEGIN
  -- We only group notifications for 'post' likes in this implementation
  IF NEW.entity_type = 'post' THEN
    v_type := 'post_like';
    
    -- Get post author
    SELECT author_id, SUBSTRING(title FROM 1 FOR 30) INTO v_recipient_id, v_post_title
    FROM public.posts
    WHERE id = NEW.entity_id;
    
    v_title := 'New Like';
    v_link := '/posts/' || NEW.entity_id;
    v_metadata := jsonb_build_object('post_id', NEW.entity_id);
  ELSE
    RETURN NEW;
  END IF;

  -- If recipient is same as actor, do not notify
  IF v_recipient_id IS NULL OR v_recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor's display name
  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_actor_name := COALESCE(v_actor_name, 'Someone');

  -- Check if an unread notification already exists for this reference_id and type
  SELECT id, recent_actors, group_count
  INTO v_notif_id, v_recent_actors, v_group_count
  FROM public.notifications
  WHERE user_id = v_recipient_id
    AND reference_id = NEW.entity_id
    AND type = v_type
    AND is_read = FALSE
  LIMIT 1;

  IF FOUND THEN
    -- Increment group_count
    v_group_count := v_group_count + 1;
    
    -- Append actor if not already in recent_actors
    IF NOT (NEW.user_id = ANY(v_recent_actors)) THEN
      v_recent_actors := array_append(v_recent_actors, NEW.user_id);
    END IF;

    UPDATE public.notifications
    SET group_count = v_group_count,
        recent_actors = v_recent_actors,
        created_at = NOW() -- Bubble it to top of the feed
    WHERE id = v_notif_id;
  ELSE
    -- Insert a new row with group_count = 1
    v_message := v_actor_name || ' liked your post.';
    
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link,
      metadata,
      reference_id,
      group_count,
      recent_actors
    ) VALUES (
      v_recipient_id,
      v_type,
      v_title,
      v_message,
      v_link,
      v_metadata,
      NEW.entity_id,
      1,
      ARRAY[NEW.user_id]
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Bind trigger to likes table
DROP TRIGGER IF EXISTS trg_likes_notification ON public.likes;
CREATE TRIGGER trg_likes_notification
AFTER INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_like_notification();
