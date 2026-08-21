-- =============================================================================
-- Migration: Interactive Club Financial Transparency Dashboard
-- Issue: #3277 - Implement 'Interactive Club Financial Transparency Dashboard'
-- Description: Creates a Postgres RPC to safely aggregate club expenses by 
-- category for the current academic year. Enforces strict privacy by only 
-- returning high-level aggregates, never individual line items.
-- =============================================================================
-- 1. RPC: Get Club Spending Breakdown
-- Aggregates expenses by category for the current academic year (Aug 1 - Jul 31)
CREATE OR REPLACE FUNCTION public.get_club_spending_breakdown(p_club_id UUID) RETURNS TABLE (
        category TEXT,
        total_spent NUMERIC,
        transaction_count INT
    ) AS $$
DECLARE v_academic_year_start DATE;
v_academic_year_end DATE;
v_current_month INT;
BEGIN -- Determine the current academic year boundaries
-- Academic year typically runs August 1 to July 31 of the following year
v_current_month := EXTRACT(
    MONTH
    FROM CURRENT_DATE
);
IF v_current_month >= 8 THEN v_academic_year_start := make_date(
    EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INT,
    8,
    1
);
v_academic_year_end := make_date(
    EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INT + 1,
    7,
    31
);
ELSE v_academic_year_start := make_date(
    EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INT - 1,
    8,
    1
);
v_academic_year_end := make_date(
    EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INT,
    7,
    31
);
END IF;
-- Verify the caller has permission to view this club's financials
-- (Assuming general members can view transparency data if the club allows it)
IF NOT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = p_club_id
        AND c.is_financially_transparent = TRUE
)
AND NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'treasurer')
) THEN RAISE EXCEPTION 'Unauthorized or financial transparency is disabled for this club.';
END IF;
-- Return aggregated data
RETURN QUERY
SELECT COALESCE(e.category, 'Uncategorized') AS category,
    SUM(ABS(e.amount_cents))::NUMERIC / 100.0 AS total_spent,
    -- Convert cents to dollars
    COUNT(*)::INT AS transaction_count
FROM public.expenses e
WHERE e.club_id = p_club_id
    AND e.status = 'approved'
    AND e.incurred_at >= v_academic_year_start
    AND e.incurred_at <= v_academic_year_end
GROUP BY e.category
ORDER BY total_spent DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. RPC: Get Total Funds Reinvested into Events
-- Calculates the sum of expenses specifically tagged as event-related
CREATE OR REPLACE FUNCTION public.get_event_reinvestment_total(p_club_id UUID) RETURNS NUMERIC AS $$
DECLARE v_total NUMERIC;
BEGIN
SELECT COALESCE(SUM(ABS(e.amount_cents)), 0)::NUMERIC / 100.0 INTO v_total
FROM public.expenses e
WHERE e.club_id = p_club_id
    AND e.status = 'approved'
    AND e.is_event_related = TRUE
    AND e.incurred_at >= make_date(
        EXTRACT(
            YEAR
            FROM CURRENT_DATE
        )::INT - (
            CASE
                WHEN EXTRACT(
                    MONTH
                    FROM CURRENT_DATE
                ) < 8 THEN 1
                ELSE 0
            END
        )::INT,
        8,
        1
    );
RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Add transparency toggle to clubs table (if not exists)
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS is_financially_transparent BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.clubs.is_financially_transparent IS 'If true, general members can view the aggregated spending breakdown dashboard.';
