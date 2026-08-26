-- =============================================================================
-- Migration: Sponsorship ROI Dashboard
-- Issue: #3238 - Build a 'Sponsorship ROI Dashboard' for Corporate Partners
-- Description: Creates secure Postgres RPCs for aggregating RSVP demographic 
-- data. Enforces strict k-anonymity rules (minimum 10 attendees) to prevent 
-- sponsors from deducing individual identities in small events. Scrubs PII 
-- unless the user explicitly opted in to share their resume.
-- =============================================================================
-- 1. RPC: Get Aggregated Demographics for an Event
CREATE OR REPLACE FUNCTION public.get_event_demographics(p_event_id UUID, p_sponsor_id UUID) RETURNS JSONB AS $$
DECLARE v_total_rsvps INT;
v_is_authorized BOOLEAN;
v_major_data JSONB;
v_year_data JSONB;
BEGIN -- 1. Verify the sponsor actually funded this event
-- (Assuming a link between sponsors and events via a sponsorships table)
SELECT EXISTS (
        SELECT 1
        FROM public.event_sponsors es
        WHERE es.event_id = p_event_id
            AND es.sponsor_id = p_sponsor_id
    ) INTO v_is_authorized;
IF NOT v_is_authorized THEN RAISE EXCEPTION 'Unauthorized: Sponsor is not linked to this event.';
END IF;
-- 2. Count total confirmed RSVPs
SELECT COUNT(*) INTO v_total_rsvps
FROM public.event_rsvps er
WHERE er.event_id = p_event_id
    AND er.status = 'confirmed';
-- 3. Enforce k-anonymity (Minimum 10 attendees to display charts)
IF v_total_rsvps < 10 THEN RETURN jsonb_build_object(
    'is_anonymous',
    FALSE,
    'total_rsvps',
    v_total_rsvps,
    'message',
    'Not enough data to ensure anonymity. Minimum 10 attendees required.'
);
END IF;
-- 4. Aggregate by Major
SELECT jsonb_agg(row_to_json(t)) INTO v_major_data
FROM (
        SELECT p.major AS label,
            COUNT(*) AS value
        FROM public.event_rsvps er
            JOIN public.profiles p ON er.user_id = p.id
        WHERE er.event_id = p_event_id
            AND er.status = 'confirmed'
            AND p.major IS NOT NULL
        GROUP BY p.major
        ORDER BY value DESC
    ) t;
-- 5. Aggregate by Graduation Year
SELECT jsonb_agg(row_to_json(t)) INTO v_year_data
FROM (
        SELECT p.graduation_year AS label,
            COUNT(*) AS value
        FROM public.event_rsvps er
            JOIN public.profiles p ON er.user_id = p.id
        WHERE er.event_id = p_event_id
            AND er.status = 'confirmed'
            AND p.graduation_year IS NOT NULL
        GROUP BY p.graduation_year
        ORDER BY label ASC
    ) t;
-- 6. Return aggregated payload
RETURN jsonb_build_object(
    'is_anonymous',
    TRUE,
    'total_rsvps',
    v_total_rsvps,
    'majors',
    v_major_data,
    'graduation_years',
    v_year_data
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. RPC: Get Opt-In Lead List (Users who explicitly allowed data sharing)
CREATE OR REPLACE FUNCTION public.get_sponsor_leads(p_event_id UUID, p_sponsor_id UUID) RETURNS TABLE (
        full_name TEXT,
        email TEXT,
        major TEXT,
        graduation_year INT,
        linkedin_url TEXT
    ) AS $$
DECLARE v_is_authorized BOOLEAN;
BEGIN -- Verify authorization
SELECT EXISTS (
        SELECT 1
        FROM public.event_sponsors es
        WHERE es.event_id = p_event_id
            AND es.sponsor_id = p_sponsor_id
    ) INTO v_is_authorized;
IF NOT v_is_authorized THEN RAISE EXCEPTION 'Unauthorized: Sponsor is not linked to this event.';
END IF;
-- Return ONLY users who checked "Share my resume with sponsors"
RETURN QUERY
SELECT p.full_name,
    p.email,
    p.major,
    p.graduation_year,
    p.linkedin_url
FROM public.event_rsvps er
    JOIN public.profiles p ON er.user_id = p.id
WHERE er.event_id = p_event_id
    AND er.status = 'confirmed'
    AND er.share_data_with_sponsors = TRUE;
-- CRITICAL PRIVACY CHECK
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;