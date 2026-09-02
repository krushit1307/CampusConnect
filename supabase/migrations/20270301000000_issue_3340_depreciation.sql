-- Migration: Financial Depreciation Engine (Issue #3340)
-- Description: Adds asset_class, purchase_date, purchase_price to inventory_items
-- and creates RPCs for Straight-Line Depreciation and GAAP Balance Sheet.

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS asset_class TEXT,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2);

-- =============================================================================
-- RPC: Straight-Line Depreciation for a single asset (Issue #3340)
-- Formula: (Purchase Price / Lifespan Years)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_depreciation_value(
    p_purchase_price NUMERIC,
    p_lifespan_years NUMERIC,
    p_purchase_date DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_years_active NUMERIC;
    v_accumulated NUMERIC;
    v_book_value NUMERIC;
BEGIN
    IF p_purchase_price IS NULL OR p_lifespan_years IS NULL OR p_purchase_date IS NULL OR p_lifespan_years <= 0 THEN
        RETURN COALESCE(p_purchase_price, 0);
    END IF;

    v_years_active := GREATEST(0, (EXTRACT(EPOCH FROM (CURRENT_DATE - p_purchase_date)) / 31557600));
    v_accumulated := LEAST(p_purchase_price, (p_purchase_price / p_lifespan_years) * v_years_active);
    v_book_value := GREATEST(0, p_purchase_price - v_accumulated);
    RETURN ROUND(v_book_value, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- RPC: Club Balance Sheet
-- Returns cash_balance, inventory_value, and total_assets for the club
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_club_balance_sheet(p_club_id UUID)
RETURNS TABLE (
    total_assets NUMERIC,
    cash_balance NUMERIC,
    inventory_value NUMERIC
) AS $$
DECLARE
    v_cash NUMERIC := 0;
    v_inventory NUMERIC := 0;
BEGIN
    -- 1. Cash Balance from financial ledgers
    SELECT COALESCE(SUM(amount), 0) INTO v_cash
    FROM public.club_transactions
    WHERE club_id = p_club_id;

    -- 2. Depreciated Inventory Value
    -- We assume asset_class contains a number, e.g. "Electronics = 3 yr lifespan" -> 3
    SELECT COALESCE(SUM(
        public.calculate_depreciation_value(
            purchase_price,
            COALESCE(
                NULLIF(regexp_replace(asset_class, '[^0-9.]', '', 'g'), '')::NUMERIC,
                3 -- default 3 years if not parsed
            ),
            purchase_date
        )
    ), 0)
    INTO v_inventory
    FROM public.inventory_items
    WHERE owner_club_id = p_club_id AND purchase_price IS NOT NULL;

    RETURN QUERY SELECT (v_cash + v_inventory), v_cash, v_inventory;
END;
$$ LANGUAGE plpgsql STABLE;
