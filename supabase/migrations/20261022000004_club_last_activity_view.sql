-- Migration: 20261022000004_club_last_activity_view.sql
-- Description: Create a view to unify activity signals for clubs.

-- It unifies: MAX(events.created_at), MAX(posts.created_at), MAX(club_members.joined_at), MAX(club_executives.last_login).
-- Note: 'posts' table and 'events' table exist.
-- Assuming club_members.joined_at exists.
-- Since there might not be a 'club_executives' table directly (usually it's club_members with role='admin' joined with profiles.updated_at or similar for login),
-- I will use profiles.updated_at for members with role IN ('admin', 'owner') if possible.

CREATE OR REPLACE VIEW public.club_last_activity AS
WITH event_activity AS (
    SELECT club_id, MAX(created_at) AS last_event_at
    FROM public.events
    GROUP BY club_id
),
post_activity AS (
    SELECT club_id, MAX(created_at) AS last_post_at
    FROM public.posts
    GROUP BY club_id
),
member_activity AS (
    SELECT club_id, MAX(joined_at) AS last_member_joined_at
    FROM public.club_members
    GROUP BY club_id
),
admin_activity AS (
    SELECT cm.club_id, MAX(p.updated_at) AS last_admin_active_at
    FROM public.club_members cm
    JOIN public.profiles p ON cm.user_id = p.id
    WHERE cm.role IN ('admin', 'owner')
    GROUP BY cm.club_id
)
SELECT 
    c.id AS club_id,
    c.name,
    c.status,
    c.hibernation_warning_sent_at,
    c.hibernated_at,
    GREATEST(
        COALESCE(ea.last_event_at, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(pa.last_post_at, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(ma.last_member_joined_at, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(aa.last_admin_active_at, '1970-01-01'::TIMESTAMPTZ),
        c.created_at
    ) AS last_activity_at
FROM public.clubs c
LEFT JOIN event_activity ea ON c.id = ea.club_id
LEFT JOIN post_activity pa ON c.id = pa.club_id
LEFT JOIN member_activity ma ON c.id = ma.club_id
LEFT JOIN admin_activity aa ON c.id = aa.club_id;
