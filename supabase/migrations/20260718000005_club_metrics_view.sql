CREATE OR REPLACE VIEW public.club_recent_activity_metrics AS
SELECT 
    c.id AS club_id,
    c.name AS club_name,
    COUNT(DISTINCT p.id) AS recent_posts_count,
    COUNT(DISTINCT cm.id) AS recent_approvals_count,
    COUNT(DISTINCT er.id) AS recent_rsvps_count
FROM public.clubs c
LEFT JOIN public.posts p 
    ON p.club_id = c.id 
    AND p.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.club_members cm 
    ON cm.club_id = c.id 
    AND cm.status = 'approved' 
    AND cm.joined_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.events e 
    ON e.club_id = c.id
LEFT JOIN public.event_rsvps er 
    ON er.event_id = e.id 
    AND er.rsvp_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name;

-- Grant read-only access to authenticated users
GRANT SELECT ON public.club_recent_activity_metrics TO authenticated;
