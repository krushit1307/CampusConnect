-- Migration: Create v_club_growth_stats view for Month-over-Month club growth
CREATE OR REPLACE VIEW v_club_growth_stats AS
WITH monthly_member_counts AS (
    SELECT
        club_id,
        DATE_TRUNC('month', created_at) AS month,
        COUNT(id) AS new_members
    FROM
        club_members
    GROUP BY
        club_id,
        DATE_TRUNC('month', created_at)
),
growth_calculations AS (
    SELECT
        club_id,
        month,
        new_members,
        LAG(new_members) OVER (
            PARTITION BY club_id 
            ORDER BY month
        ) AS prev_month_members
    FROM
        monthly_member_counts
)
SELECT
    club_id,
    month,
    new_members,
    COALESCE(prev_month_members, 0) AS prev_month_members,
    CASE 
        WHEN prev_month_members IS NULL OR prev_month_members = 0 THEN NULL
        ELSE ROUND(
            ((new_members - prev_month_members)::numeric / prev_month_members::numeric) * 100, 
            2
        )
    END AS mom_growth_percentage
FROM
    growth_calculations
ORDER BY
    club_id,
    month DESC;