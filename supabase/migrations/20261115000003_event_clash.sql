-- =============================================================================
-- Migration: Automated "Event Clash" Negotiation
-- Issue: #3708 - Implement 'Automated "Event Clash" Negotiation'
-- Description: Adds a club tier field and records detected clashes. Provides an
-- RPC that computes temporal + demographic overlap (>30% shared members) so a
-- draft can be paused for mediated negotiation before publishing.
-- =============================================================================
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS tier INT NOT NULL DEFAULT 3 CHECK (
        tier BETWEEN 1 AND 3
    );
COMMENT ON COLUMN public.clubs.tier IS '1 = flagship/major org, 2 = mid, 3 = standard. Clash rules target Tier 1.';
CREATE TABLE IF NOT EXISTS public.event_clashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_a UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    event_b UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    shared_members INT NOT NULL DEFAULT 0,
    overlap_minutes INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    negotiation_channel_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_a, event_b)
);
-- =============================================================================
-- RPC: Count shared members between two clubs (>30% overlap is a "severe" clash)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.count_shared_club_members(p_club_a UUID, p_club_b UUID) RETURNS TABLE (shared INT, overlap_pct NUMERIC) AS $$
DECLARE v_a INT;
v_b INT;
v_shared INT;
BEGIN
SELECT COUNT(*) INTO v_a
FROM public.club_members
WHERE club_id = p_club_a
    AND status = 'approved';
SELECT COUNT(*) INTO v_b
FROM public.club_members
WHERE club_id = p_club_b
    AND status = 'approved';
SELECT COUNT(*) INTO v_shared
FROM public.club_members ma
    JOIN public.club_members mb ON ma.user_id = mb.user_id
WHERE ma.club_id = p_club_a
    AND mb.club_id = p_club_b
    AND ma.status = 'approved'
    AND mb.status = 'approved';
RETURN QUERY
SELECT v_shared,
    CASE
        WHEN LEAST(v_a, v_b) = 0 THEN 0
        ELSE ROUND((v_shared::NUMERIC / LEAST(v_a, v_b)) * 100, 1)
    END;
END;
$$ LANGUAGE plpgsql STABLE;
-- =============================================================================
-- RPC: Detect clashes for a draft event (temporal overlap + Tier 1 + >30% shared)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.detect_event_clashes(p_event_id UUID) RETURNS TABLE (
        other_event_id UUID,
        other_title TEXT,
        other_club_name TEXT,
        shared_members INT,
        overlap_pct NUMERIC,
        overlap_minutes INT
    ) AS $$
DECLARE v_start TIMESTAMPTZ;
v_end TIMESTAMPTZ;
v_club UUID;
BEGIN
SELECT event_date,
    end_date,
    club_id INTO v_start,
    v_end,
    v_club
FROM public.events
WHERE id = p_event_id;
RETURN QUERY
SELECT e.id,
    e.title,
    c.name,
    s.shared,
    s.overlap_pct,
    (
        EXTRACT(
            EPOCH
            FROM (
                    LEAST(e.end_date, v_end) - GREATEST(e.event_date, v_start)
                )
        ) / 60
    )::INT
FROM public.events e
    JOIN public.clubs c ON c.id = e.club_id
    CROSS JOIN LATERAL public.count_shared_club_members(v_club, e.club_id) s
WHERE e.id <> p_event_id
    AND e.status IN ('published', 'approved')
    AND c.tier = 1
    AND e.event_date < v_end
    AND e.end_date > v_start -- temporal overlap
    AND s.overlap_pct > 30 -- demographic threshold
ORDER BY s.overlap_pct DESC;
END;
$$ LANGUAGE plpgsql STABLE;
ALTER TABLE public.event_clashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view clashes" ON public.event_clashes FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "System writes clashes" ON public.event_clashes FOR ALL USING (auth.role() = 'service_role');
