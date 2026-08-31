-- =============================================================================
-- Migration: Automated "Event Equipment" Depreciation Tracker
-- Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
-- Description: Extends inventory_items with acquisition metadata and adds a
-- Straight-Line Depreciation RPC so Treasurers see live book values and
-- end-of-life replacement alerts on the Financial Dashboard.
-- =============================================================================
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS purchase_date DATE,
    ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS estimated_lifespan_months INT;
COMMENT ON COLUMN public.inventory_items.estimated_lifespan_months IS 'Expected useful life of the asset in months (e.g. 48 for a camera).';
-- =============================================================================
-- RPC: Straight-Line Depreciation for a single asset
-- Formula: accumulated = (purchase_price / lifespan) * months_active
--          book_value  = purchase_price - accumulated (floored at 0)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_asset_depreciation(
        p_purchase_price NUMERIC,
        p_lifespan_months INT,
        p_purchase_date DATE
    ) RETURNS TABLE (
        months_active INT,
        monthly_depreciation NUMERIC,
        accumulated_depreciation NUMERIC,
        book_value NUMERIC,
        remaining_value_pct NUMERIC
    ) AS $$
DECLARE v_months INT;
v_monthly NUMERIC;
v_accum NUMERIC;
v_book NUMERIC;
BEGIN IF p_purchase_price IS NULL
OR p_lifespan_months IS NULL
OR p_purchase_date IS NULL
OR p_lifespan_months <= 0 THEN RETURN QUERY
SELECT 0,
    0::NUMERIC,
    0::NUMERIC,
    COALESCE(p_purchase_price, 0),
    100::NUMERIC;
RETURN;
END IF;
v_months := GREATEST(
    0,
    (
        EXTRACT(
            YEAR
            FROM age(CURRENT_DATE, p_purchase_date)
        ) * 12 + EXTRACT(
            MONTH
            FROM age(CURRENT_DATE, p_purchase_date)
        )
    )::INT
);
v_monthly := p_purchase_price / p_lifespan_months;
v_accum := LEAST(p_purchase_price, v_monthly * v_months);
v_book := GREATEST(0, p_purchase_price - v_accum);
RETURN QUERY
SELECT v_months,
    ROUND(v_monthly, 2),
    ROUND(v_accum, 2),
    ROUND(v_book, 2),
    ROUND((v_book / p_purchase_price) * 100, 1);
END;
$$ LANGUAGE plpgsql STABLE;
-- =============================================================================
-- RPC: Club-wide depreciation rollup (drives the Asset Health chart)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_club_asset_depreciation(p_club_id UUID) RETURNS TABLE (
        item_id UUID,
        item_name TEXT,
        purchase_price NUMERIC,
        book_value NUMERIC,
        remaining_value_pct NUMERIC,
        months_active INT,
        lifespan_months INT
    ) AS $$ BEGIN RETURN QUERY
SELECT i.id,
    i.name,
    i.purchase_price,
    d.book_value,
    d.remaining_value_pct,
    d.months_active,
    i.estimated_lifespan_months
FROM public.inventory_items i
    CROSS JOIN LATERAL public.calculate_asset_depreciation(
        i.purchase_price,
        i.estimated_lifespan_months,
        i.purchase_date
    ) d
WHERE i.club_id = p_club_id
    AND i.purchase_price IS NOT NULL
ORDER BY d.remaining_value_pct ASC;
END;
$$ LANGUAGE plpgsql STABLE;
