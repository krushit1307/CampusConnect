-- =============================================================================
-- Migration: Club Asset Depreciation & Replacement Planning
-- Description: Adds a financial register on top of the existing inventory:
--              what an asset cost, how long it is expected to last and how it
--              is written down, plus period-end book value snapshots and the
--              reserve a club is building towards replacing it.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_depreciation_method') THEN
        CREATE TYPE public.asset_depreciation_method AS ENUM (
            'straight_line',
            'declining_balance',
            'units_of_production'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_condition') THEN
        CREATE TYPE public.asset_condition AS ENUM ('excellent', 'good', 'fair', 'poor');
    END IF;
END$$;

-- 1. Asset register ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    -- Integer minor units, like every other financial figure in the platform.
    acquisition_cost_cents BIGINT NOT NULL,
    acquisition_date DATE NOT NULL,
    useful_life_months SMALLINT NOT NULL DEFAULT 60,
    salvage_value_cents BIGINT NOT NULL DEFAULT 0,
    method public.asset_depreciation_method NOT NULL DEFAULT 'straight_line',
    declining_rate_percent NUMERIC(5, 2),
    total_expected_units INT,
    units_used INT DEFAULT 0,
    condition public.asset_condition NOT NULL DEFAULT 'good',
    disposal_date DATE,
    disposal_proceeds_cents BIGINT,
    -- Optional link to the rental system, which tracks where the item is.
    inventory_item_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_assets_cost_positive CHECK (acquisition_cost_cents >= 0),
    CONSTRAINT club_assets_salvage_within_cost CHECK (
        salvage_value_cents >= 0 AND salvage_value_cents <= acquisition_cost_cents
    ),
    CONSTRAINT club_assets_life_positive CHECK (useful_life_months > 0),
    CONSTRAINT club_assets_rate_range CHECK (
        declining_rate_percent IS NULL OR declining_rate_percent BETWEEN 0 AND 99
    ),
    CONSTRAINT club_assets_units_required CHECK (
        method <> 'units_of_production' OR total_expected_units > 0
    ),
    CONSTRAINT club_assets_disposal_after_acquisition CHECK (
        disposal_date IS NULL OR disposal_date >= acquisition_date
    )
);

CREATE INDEX IF NOT EXISTS idx_club_assets_club
    ON public.club_assets (club_id) WHERE disposal_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_club_assets_category
    ON public.club_assets (club_id, category);

-- 2. Period-end snapshots ----------------------------------------------------
--
-- Book value is computed rather than stored, but a club still needs a frozen
-- figure at year end for the accounts it hands to the Student Union.
CREATE TABLE IF NOT EXISTS public.club_asset_depreciation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.club_assets(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    as_of DATE NOT NULL,
    book_value_cents BIGINT NOT NULL,
    accumulated_depreciation_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_asset_snapshots_unique UNIQUE (asset_id, as_of),
    CONSTRAINT club_asset_snapshots_non_negative CHECK (
        book_value_cents >= 0 AND accumulated_depreciation_cents >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_club_asset_snapshots_club_date
    ON public.club_asset_depreciation_snapshots (club_id, as_of DESC);

-- 3. Replacement reserve -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_asset_reserves (
    club_id UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    contributions_per_year SMALLINT NOT NULL DEFAULT 2,
    planning_horizon_years SMALLINT NOT NULL DEFAULT 5,
    inflation_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_asset_reserves_balance_positive CHECK (balance_cents >= 0),
    CONSTRAINT club_asset_reserves_horizon_range CHECK (planning_horizon_years BETWEEN 1 AND 20),
    CONSTRAINT club_asset_reserves_contributions_range CHECK (
        contributions_per_year BETWEEN 1 AND 12
    ),
    CONSTRAINT club_asset_reserves_inflation_range CHECK (
        inflation_rate_percent BETWEEN 0 AND 100
    )
);

-- 4. Register value helper ---------------------------------------------------
--
-- Straight line only, and deliberately so: this is the figure the treasurer
-- quotes for the balance sheet, and the richer methods live in the application
-- layer where they are unit tested.
CREATE OR REPLACE FUNCTION public.club_register_cost_cents(p_club_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(acquisition_cost_cents), 0)::BIGINT
    FROM public.club_assets
    WHERE club_id = p_club_id
      AND disposal_date IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.club_register_cost_cents(UUID) TO authenticated;

-- 5. Row level security ------------------------------------------------------

ALTER TABLE public.club_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_asset_depreciation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_asset_reserves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view the asset register" ON public.club_assets;
CREATE POLICY "Members can view the asset register"
ON public.club_assets FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage the asset register" ON public.club_assets;
CREATE POLICY "Officers manage the asset register"
ON public.club_assets FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view snapshots" ON public.club_asset_depreciation_snapshots;
CREATE POLICY "Members can view snapshots"
ON public.club_asset_depreciation_snapshots FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers write snapshots" ON public.club_asset_depreciation_snapshots;
CREATE POLICY "Officers write snapshots"
ON public.club_asset_depreciation_snapshots FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view the reserve" ON public.club_asset_reserves;
CREATE POLICY "Members can view the reserve"
ON public.club_asset_reserves FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage the reserve" ON public.club_asset_reserves;
CREATE POLICY "Officers manage the reserve"
ON public.club_asset_reserves FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

-- 6. Keep updated_at honest --------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_club_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_club_asset ON public.club_assets;
CREATE TRIGGER trg_touch_club_asset
BEFORE UPDATE ON public.club_assets
FOR EACH ROW
EXECUTE FUNCTION public.touch_club_asset();
