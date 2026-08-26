-- Migration: 20260727040000_keyset_pagination.sql
-- Description: Create keyset (cursor-based) pagination functions and supporting compound indexes for feed and RSVPs.

-- 1. Create compound indexes for O(1) keyset lookup performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at_id 
ON public.posts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_rsvp_at_id 
ON public.event_rsvps (event_id, rsvp_at DESC, id DESC);

-- 2. Create get_posts_cursor RPC function
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
        last_created_at IS NULL 
        OR last_id IS NULL 
        OR (created_at, id) < (last_created_at, last_id)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT fetch_limit;
END;
$$;

-- 3. Create get_rsvps_cursor RPC function
CREATE OR REPLACE FUNCTION public.get_rsvps_cursor(
    p_event_id UUID,
    last_rsvp_at TIMESTAMPTZ,
    last_id UUID,
    fetch_limit INT DEFAULT 10
)
RETURNS SETOF public.event_rsvps
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND (
        last_rsvp_at IS NULL 
        OR last_id IS NULL 
        OR (rsvp_at, id) < (last_rsvp_at, last_id)
      )
    ORDER BY rsvp_at DESC, id DESC
    LIMIT fetch_limit;
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_posts_cursor(TIMESTAMPTZ, UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_posts_cursor(TIMESTAMPTZ, UUID, INT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_rsvps_cursor(UUID, TIMESTAMPTZ, UUID, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_rsvps_cursor(UUID, TIMESTAMPTZ, UUID, INT) TO service_role;
