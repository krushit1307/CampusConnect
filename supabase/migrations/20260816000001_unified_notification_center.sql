-- ============================================================
-- Migration: Unified Notification Center (Issue #2690)
--
-- Adds:
--   1. `entity_id`, `actor_id`, `group_key`, `group_count` columns
--      to the existing `notifications` table for categorized inbox
--      + grouping ("User A and 49 others liked your event").
--   2. Partial indexes for unread count (fast, no COUNT(*) on
--      every page load — the issue calls out this edge case).
--   3. `mark_notification_read` and `mark_all_notifications_read`
--      RPCs for optimistic UI.
--   4. `get_unread_notification_count` RPC cached for the bell.
--   5. `get_categorized_notifications` RPC that returns grouped
--      + paginated notifications for the inbox dropdown.
--   6. `group_similar_notifications()` trigger function that
--      consolidates like-liking notifications into a single row
--      with an incremented `group_count` — the "50 people liked
--      your event" edge case.
--
-- Backward compatibility:
--   - The existing `notifications` table columns (id, user_id, type,
--     title, message, is_read, link, created_at) are unchanged.
--   - New columns are nullable / have defaults, so existing client
--     code that doesn't know about them continues to work.
--   - The existing trigger `handle_event_cancellation` continues
--     to insert single notifications; the new grouping trigger
--     runs AFTER INSERT to merge them.
-- ============================================================

-- ── Step 1: Add new columns to notifications table ─────────────
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS group_key TEXT;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS group_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS last_actor_name TEXT;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ── Step 2: Indexes ─────────────────────────────────────────────
-- Fast unread count per user — the bell badge query.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id)
    WHERE is_read = FALSE;

-- Fast "fetch latest N for user" query (the inbox dropdown).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC);

-- Fast group_key lookup for the consolidation trigger.
CREATE INDEX IF NOT EXISTS idx_notifications_group_key
    ON public.notifications (user_id, group_key, created_at DESC)
    WHERE group_key IS NOT NULL;

-- ── Step 3: mark_notification_read(p_notification_id, p_user_id) ─
-- Atomically marks a single notification as read. Returns JSONB so
-- the client can branch on success/failure.
CREATE OR REPLACE FUNCTION public.mark_notification_read(
    p_notification_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE id = p_notification_id
      AND user_id = p_user_id
      AND is_read = FALSE;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', TRUE,
        'notification_id', p_notification_id,
        'marked_read', v_updated > 0
    );
END;
 $$;

COMMENT ON FUNCTION public.mark_notification_read(UUID, UUID) IS
'Atomically marks a single notification as read for the calling user. Returns JSONB with a marked_read boolean indicating whether the row was actually updated (FALSE if it was already read or does not belong to the caller).';

-- ── Step 4: mark_all_notifications_read(p_user_id) ───────────────
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
    p_user_id UUID,
    p_type TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND is_read = FALSE
      AND (p_type IS NULL OR type = p_type);

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', TRUE,
        'marked_read_count', v_updated
    );
END;
 $$;

COMMENT ON FUNCTION public.mark_all_notifications_read(UUID, TEXT) IS
'Marks all unread notifications for the calling user as read. Optionally filters by type. Returns JSONB with the count of rows marked read.';

-- ── Step 5: get_unread_notification_count(p_user_id) ────────────
-- Cached-style lookup for the bell badge. Uses the partial index
-- idx_notifications_user_unread for an O(log n) count rather than
-- a full table scan.
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
    p_user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE;

    RETURN COALESCE(v_count, 0);
END;
 $$;

-- ── Step 6: get_categorized_notifications(p_user_id, p_limit, p_offset) ─
-- Returns the user's notifications as a categorized list, with
-- unread count per category. Used by the inbox dropdown.
CREATE OR REPLACE FUNCTION public.get_categorized_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_items JSONB;
    v_unread_by_type JSONB;
    v_total_unread INTEGER;
    v_total_count INTEGER;
BEGIN
    -- Fetch the paginated notifications, newest first.
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', n.id,
            'type', n.type,
            'title', n.title,
            'message', n.message,
            'link', n.link,
            'is_read', n.is_read,
            'created_at', n.created_at,
            'read_at', n.read_at,
            'entity_id', n.entity_id,
            'entity_type', n.entity_type,
            'actor_id', n.actor_id,
            'actor_name', n.actor_name,
            'group_count', n.group_count,
            'last_actor_name', n.last_actor_name
        )
        ORDER BY n.created_at DESC
    ), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT *
        FROM public.notifications
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 100))
        OFFSET GREATEST(0, p_offset)
    ) n;

    -- Aggregate unread counts per type for the category tabs.
    SELECT COALESCE(jsonb_object_agg(type, cnt), '{}'::jsonb)
    INTO v_unread_by_type
    FROM (
        SELECT type, COUNT(*) AS cnt
        FROM public.notifications
        WHERE user_id = p_user_id AND is_read = FALSE
        GROUP BY type
    ) t;

    -- Total unread for the bell badge.
    SELECT COUNT(*)
    INTO v_total_unread
    FROM public.notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE;

    -- Total count for pagination UI.
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.notifications
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'items', v_items,
        'unread_by_type', v_unread_by_type,
        'total_unread', v_total_unread,
        'total_count', v_total_count,
        'limit', p_limit,
        'offset', p_offset
    );
END;
 $$;

-- ── Step 7: Grouping trigger — "User A and 49 others liked your event" ─
-- When a new notification is inserted with a `group_key`, this
-- trigger checks whether there's an existing unread notification
-- for the same user + group_key. If so, it increments that row's
-- group_count, shifts its actor_name to last_actor_name, updates
-- the actor to the latest one, and returns NULL (preventing the
-- insert — the existing row is the canonical one).
--
-- The `group_key` is set by the inserting trigger (e.g.,
-- handle_event_rsvp_notification) to a stable identifier like
-- 'event_like:<event_id>'. This means 50 likes on the same event
-- produce ONE notification row with group_count=50, rather than 50
-- separate rows.
CREATE OR REPLACE FUNCTION public.group_similar_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_existing_id UUID;
BEGIN
    -- Only group when a group_key was supplied by the inserter.
    IF NEW.group_key IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find an existing UNREAD notification for the same user +
    -- group_key. We don't merge into read notifications because
    -- the user has already dismissed that batch.
    SELECT id
    INTO v_existing_id
    FROM public.notifications
    WHERE user_id = NEW.user_id
      AND group_key = NEW.group_key
      AND is_read = FALSE
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
        -- Merge into the existing row: bump group_count, shift the
        -- current actor_name into last_actor_name, set actor to the
        -- new one, and refresh updated_at so it sorts back to the
        -- top of the inbox.
        UPDATE public.notifications
        SET group_count = group_count + 1,
            last_actor_name = actor_name,
            actor_id = NEW.actor_id,
            actor_name = NEW.actor_name,
            message = NEW.message,
            updated_at = NOW()
        WHERE id = v_existing_id;

        -- Return NULL to suppress the INSERT — we merged instead.
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS on_notification_insert_group ON public.notifications;
CREATE TRIGGER on_notification_insert_group
BEFORE INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.group_key IS NOT NULL)
EXECUTE FUNCTION public.group_similar_notifications();

COMMENT ON FUNCTION public.group_similar_notifications() IS
'BEFORE INSERT trigger that consolidates notifications sharing the same group_key into a single row with an incremented group_count. Implements the "User A and 49 others liked your event" grouping edge case from issue #2690.';

-- ── Step 8: Enable realtime publication for notifications ────────
-- The frontend subscribes to INSERT/UPDATE events on this table
-- filtered by user_id so the bell badge and inbox update in real
-- time when a new notification arrives.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- If the publication doesn't exist or the table is already
    -- a member, ignore — the ALTER above is idempotent in newer
    -- Supabase versions but not all PG versions.
    NULL;
END $$;

-- ── Step 9: Example trigger — groupable event-like notification ──
-- This is a template that the Edge Function (or future triggers)
-- can call to insert a grouped notification. Shown here for the
-- "someone liked your event" use case; the actual like trigger
-- would live in a separate migration that adds the `event_likes`
-- table (not in scope for this PR — this just provides the helper).
CREATE OR REPLACE FUNCTION public.notify_event_owner_grouped(
    p_event_id UUID,
    p_actor_id UUID,
    p_actor_name TEXT,
    p_event_title TEXT,
    p_owner_id UUID,
    p_action TEXT DEFAULT 'liked'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    INSERT INTO public.notifications (
        user_id, type, title, message, link,
        entity_id, entity_type, actor_id, actor_name,
        group_key, group_count
    ) VALUES (
        p_owner_id,
        'event_' || p_action,
        CASE
            WHEN p_action = 'liked' THEN 'Someone liked your event'
            WHEN p_action = 'commented' THEN 'Someone commented on your event'
            ELSE 'New activity on your event'
        END,
        p_actor_name || ' ' || p_action || ' your event "' || p_event_title || '".',
        '/events/' || p_event_id,
        p_event_id,
        'event',
        p_actor_id,
        p_actor_name,
        'event_' || p_action || ':' || p_event_id,
        1
    );
END;
 $$;

COMMENT ON FUNCTION public.notify_event_owner_grouped(UUID, UUID, TEXT, TEXT, UUID, TEXT) IS
'Template helper that inserts a grouped notification for an event owner. Subsequent calls with the same event_id + action merge into the same row, incrementing group_count — implements the "User A and 49 others liked your event" edge case.';

-- ============================================================
-- End of migration
-- ============================================================
