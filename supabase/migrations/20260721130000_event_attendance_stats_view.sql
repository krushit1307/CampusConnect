-- ============================================================
-- Migration: 20260721130000_event_attendance_stats_view.sql
-- Issue: #594
-- Description:
--   Creates the `public.event_attendance_stats` view reporting
--   event attendance rates (RSVPs vs Checked-In users).
-- ============================================================

CREATE OR REPLACE VIEW public.event_attendance_stats AS
SELECT
    e.id AS event_id,
    COUNT(r.event_id)::integer AS total_rsvps,
    COUNT(r.event_id) FILTER (WHERE r.checked_in = TRUE)::integer AS total_checked_in,
    COALESCE(
        ROUND(
            (COUNT(r.event_id) FILTER (WHERE r.checked_in = TRUE) * 100.0)
            / NULLIF(COUNT(r.event_id), 0),
            2
        ),
        0.00
    )::numeric(5,2) AS attendance_percentage
FROM public.events e
LEFT JOIN public.event_rsvps r ON e.id = r.event_id
GROUP BY e.id;

-- Revoke default PUBLIC / anon access and grant SELECT to authorized database roles
REVOKE ALL ON public.event_attendance_stats FROM PUBLIC;
REVOKE ALL ON public.event_attendance_stats FROM anon;

GRANT SELECT ON public.event_attendance_stats TO service_role, authenticated;
