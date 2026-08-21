-- ============================================================
-- Migration: Sponsorship Prospectus Metrics (Issue #2906)
--
-- Creates an RPC that aggregates live club metrics (member count,
-- event attendance, major demographics) for the PDF generator.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_club_prospectus_metrics(
    p_club_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_club_name TEXT;
    v_club_desc TEXT;
    v_logo_url TEXT;
    v_banner_url TEXT;
    v_member_count INTEGER;
    v_event_count INTEGER;
    v_total_attendance INTEGER;
    v_majors JSONB;
    v_growth JSONB;
    v_tiers JSONB;
BEGIN
    -- Club info
    SELECT name, description, logo_url, banner_url
    INTO v_club_name, v_club_desc, v_logo_url, v_banner_url
    FROM public.clubs WHERE id = p_club_id;

    -- Member count
    SELECT COUNT(*) INTO v_member_count
    FROM public.club_members
    WHERE club_id = p_club_id AND status = 'approved';

    -- Event count + total attendance
    SELECT COUNT(*), COALESCE(SUM((
        SELECT COUNT(*) FROM public.event_rsvps r
        WHERE r.event_id = e.id AND r.status IN ('attending', 'checked_in')
    )), 0)
    INTO v_event_count, v_total_attendance
    FROM public.events e
    WHERE e.club_id = p_club_id;

    -- Major demographics
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'major', COALESCE(p.college, 'Undeclared'),
        'count', cnt
    )), '[]'::jsonb)
    INTO v_majors
    FROM (
        SELECT p.college, COUNT(*) as cnt
        FROM public.club_members cm
        JOIN public.profiles p ON p.id = cm.user_id
        WHERE cm.club_id = p_club_id AND cm.status = 'approved'
        GROUP BY p.college
        ORDER BY cnt DESC
        LIMIT 5
    ) p;

    -- Year-over-year member growth (last 4 years)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'year', yr,
        'members', cnt
    )), '[]'::jsonb)
    INTO v_growth
    FROM (
        SELECT EXTRACT(YEAR FROM joined_at)::INTEGER as yr, COUNT(*) as cnt
        FROM public.club_members
        WHERE club_id = p_club_id AND status = 'approved'
          AND joined_at >= NOW() - INTERVAL '4 years'
        GROUP BY yr
        ORDER BY yr
    ) g;

    -- Active sponsorship tiers
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', name,
        'price', price,
        'perks', perks_json
    )), '[]'::jsonb)
    INTO v_tiers
    FROM public.sponsorship_tiers
    WHERE club_id = p_club_id AND is_active = TRUE
    ORDER BY price ASC;

    RETURN jsonb_build_object(
        'club_name', v_club_name,
        'club_description', v_club_desc,
        'logo_url', v_logo_url,
        'banner_url', v_banner_url,
        'member_count', v_member_count,
        'event_count', v_event_count,
        'total_attendance', v_total_attendance,
        'avg_attendance', CASE WHEN v_event_count > 0 THEN v_total_attendance / v_event_count ELSE 0 END,
        'majors', v_majors,
        'growth', v_growth,
        'tiers', v_tiers
    );
END;
 $$;

COMMENT ON FUNCTION public.get_club_prospectus_metrics(UUID) IS
'Aggregates live club metrics (members, events, demographics, growth, tiers) for the sponsorship prospectus PDF. Issue #2906.';

-- ============================================================
-- End of migration
-- ============================================================
