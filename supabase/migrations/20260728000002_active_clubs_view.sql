-- Create a view to identify active clubs

CREATE OR REPLACE VIEW public.vw_active_clubs AS
SELECT
    c.id,
    c.name,
    c.slug,
    c.description,
    c.banner_url,
    c.logo_url,
    c.github_repo_url,
    c.visibility,
    c.social_links,
    c.created_by,
    c.created_at,
    c.updated_at,

    MAX(e.event_date) AS last_event_date,

    (
        COALESCE(
            MAX(e.event_date) >= NOW() - INTERVAL '6 months',
            FALSE
        )
        OR c.created_at >= NOW() - INTERVAL '1 month'
    ) AS is_active

FROM public.clubs c
LEFT JOIN public.events e
    ON e.club_id = c.id
GROUP BY
    c.id,
    c.name,
    c.slug,
    c.description,
    c.banner_url,
    c.logo_url,
    c.github_repo_url,
    c.visibility,
    c.social_links,
    c.created_by,
    c.created_at,
    c.updated_at;

-- Grant read access
GRANT SELECT ON public.vw_active_clubs TO authenticated;
GRANT SELECT ON public.vw_active_clubs TO anon;