-- Migration: Add JSONB payload to notifications for dynamic i18n formatting
-- Issue #3186

-- 1. Add payload column
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

-- 2. Make message nullable to support payload-only notifications
ALTER TABLE public.notifications 
ALTER COLUMN message DROP NOT NULL;

-- 3. Update get_categorized_notifications to include payload in the response
CREATE OR REPLACE FUNCTION public.get_categorized_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
            'payload', n.payload,
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
    SELECT COALESCE(jsonb_object_agg(sub.type, sub.unread_count), '{}'::jsonb)
    INTO v_unread_by_type
    FROM (
        SELECT type, COUNT(*) as unread_count
        FROM public.notifications
        WHERE user_id = p_user_id AND is_read = FALSE
        GROUP BY type
    ) sub;

    -- Calculate total unread count for the bell icon
    SELECT COALESCE(SUM((value::text)::integer), 0)
    INTO v_total_unread
    FROM jsonb_each(v_unread_by_type);

    -- Get total count of notifications for pagination
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
