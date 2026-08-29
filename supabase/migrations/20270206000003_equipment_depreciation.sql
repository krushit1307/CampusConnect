-- Migration for Equipment Depreciation Tracker (Issue #4059)
-- This migration updates the existing inventory implementation to support
-- financial depreciation math and GAAP compliance.

-- 1. Create a specialized asset classes lookup to enforce standardization
CREATE TABLE IF NOT EXISTS asset_classes (
    id VARCHAR(50) PRIMARY KEY, -- 'ELECTRONICS', 'FURNITURE', 'VEHICLES', 'SOFTWARE'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    lifespan_years INTEGER NOT NULL CHECK (lifespan_years > 0),
    salvage_value_percent DECIMAL(5,2) DEFAULT 0.0 CHECK (salvage_value_percent >= 0 AND salvage_value_percent <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed basic classes
INSERT INTO asset_classes (id, name, description, lifespan_years, salvage_value_percent) VALUES
('ELECTRONICS', 'Electronics & Computing', 'Laptops, servers, AV gear', 3, 5.0),
('FURNITURE', 'Club Furniture & Fixtures', 'Desks, chairs, whiteboards', 7, 10.0),
('VEHICLES', 'Club Vehicles', 'Golf carts, vans', 5, 20.0),
('EVENT_GEAR', 'Event & Staging Gear', 'Tents, banners, heavy equipment', 4, 10.0),
('SOFTWARE', 'Software Licenses (Perpetual)', 'One-time software purchases', 3, 0.0)
ON CONFLICT (id) DO UPDATE SET 
    lifespan_years = EXCLUDED.lifespan_years, 
    salvage_value_percent = EXCLUDED.salvage_value_percent;

-- 2. Modify existing inventory_items to support financial data
-- Note: Assuming inventory_items exists. To ensure this script always runs cleanly,
-- we create it if missing, or alter it if it exists.
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    ALTER TABLE inventory_items ADD COLUMN purchase_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ 
BEGIN 
    ALTER TABLE inventory_items ADD COLUMN purchase_price DECIMAL(12,2) CHECK (purchase_price >= 0);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ 
BEGIN 
    ALTER TABLE inventory_items ADD COLUMN asset_class VARCHAR(50) REFERENCES asset_classes(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE inventory_items ADD COLUMN condition_status VARCHAR(50) DEFAULT 'EXCELLENT';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_inv_club ON inventory_items(club_id);
CREATE INDEX IF NOT EXISTS idx_inv_class ON inventory_items(asset_class);

-- 3. Core Financial RPC for straight-line depreciation calculation
-- This RPC calculates the current value of an asset dynamically for the given exact date.
CREATE OR REPLACE FUNCTION get_current_asset_value(
    p_purchase_price DECIMAL(12,2),
    p_purchase_date DATE,
    p_lifespan_years INTEGER,
    p_salvage_percent DECIMAL(5,2),
    p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    salvage_value DECIMAL(12,2);
    depreciable_base DECIMAL(12,2);
    days_in_lifespan INTEGER;
    days_elapsed INTEGER;
    depreciation_fraction DECIMAL(10,5);
    current_value DECIMAL(12,2);
BEGIN
    -- Validation guards
    IF p_purchase_price IS NULL OR p_purchase_date IS NULL OR p_lifespan_years IS NULL THEN
        RETURN p_purchase_price; -- Can't depreciate without full data
    END IF;

    -- If target date is before purchase, asset doesn't exist yet (or isn't capitalized)
    IF p_target_date < p_purchase_date THEN
        RETURN 0.00;
    END IF;

    salvage_value := p_purchase_price * (p_salvage_percent / 100.0);
    depreciable_base := p_purchase_price - salvage_value;
    
    -- Estimate lifespan in days (using 365.25 for average leap years)
    days_in_lifespan := ROUND(p_lifespan_years * 365.25);
    days_elapsed := SELECT p_target_date - p_purchase_date;

    IF days_elapsed >= days_in_lifespan THEN
        -- Asset is fully depreciated to salvage value
        RETURN salvage_value;
    END IF;

    depreciation_fraction := days_elapsed::DECIMAL / days_in_lifespan::DECIMAL;
    current_value := p_purchase_price - (depreciable_base * depreciation_fraction);
    
    RETURN ROUND(current_value, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. RPC to generate the GAAP-compliant Balance Sheet
-- Aggregates all current assets, calculates accumulated depreciation,
-- and outputs a structured financial picture for the club.
CREATE OR REPLACE FUNCTION generate_club_balance_sheet(
    p_club_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    category VARCHAR(100),
    historical_cost_total DECIMAL(12,2),
    accumulated_depreciation DECIMAL(12,2),
    net_book_value DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH AssetCalculations AS (
        SELECT 
            ac.name as category_name,
            i.purchase_price,
            get_current_asset_value(
                i.purchase_price, 
                i.purchase_date, 
                ac.lifespan_years, 
                ac.salvage_value_percent, 
                p_as_of_date
            ) as current_val
        FROM inventory_items i
        JOIN asset_classes ac ON i.asset_class = ac.id
        WHERE i.club_id = p_club_id
          AND i.purchase_date <= p_as_of_date
          AND i.purchase_price IS NOT NULL
    )
    SELECT 
        ac.category_name::VARCHAR(100),
        COALESCE(SUM(ac.purchase_price), 0.00) as historical_cost_total,
        COALESCE(SUM(ac.purchase_price - ac.current_val), 0.00) as accumulated_depreciation,
        COALESCE(SUM(ac.current_val), 0.00) as net_book_value
    FROM AssetCalculations ac
    GROUP BY ac.category_name
    
    UNION ALL
    
    -- Grand Totals Row
    SELECT 
        'GRAND_TOTAL'::VARCHAR(100) as category,
        COALESCE(SUM(purchase_price), 0.00) as historical_cost_total,
        COALESCE(SUM(purchase_price - current_val), 0.00) as accumulated_depreciation,
        COALESCE(SUM(current_val), 0.00) as net_book_value
    FROM AssetCalculations;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Helper RPC to list inventory with real-time value attached
CREATE OR REPLACE FUNCTION get_inventory_with_valuation(
    p_club_id UUID
)
RETURNS TABLE (
    item_id UUID,
    item_name VARCHAR(255),
    purchase_date DATE,
    purchase_price DECIMAL(12,2),
    asset_class VARCHAR(50),
    net_book_value DECIMAL(12,2),
    percent_lifespan_used DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.purchase_date,
        i.purchase_price,
        i.asset_class,
        get_current_asset_value(
            i.purchase_price, 
            i.purchase_date, 
            ac.lifespan_years, 
            ac.salvage_value_percent, 
            CURRENT_DATE
        ) as net_book_value,
        CASE 
            WHEN i.purchase_date IS NULL OR ac.lifespan_years IS NULL THEN 0.00
            ELSE LEAST(100.00, ROUND(( (CURRENT_DATE - i.purchase_date)::DECIMAL / (ac.lifespan_years * 365.25)::DECIMAL ) * 100, 2))
        END as percent_lifespan_used
    FROM inventory_items i
    LEFT JOIN asset_classes ac ON i.asset_class = ac.id
    WHERE i.club_id = p_club_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Mock Data Generation for Testing Volume and Robustness
INSERT INTO inventory_items (club_id, name, purchase_date, purchase_price, asset_class, condition_status)
VALUES 
('00000000-0000-0000-0000-000000000001', 'MacBook Pro M2 - Officer 1', CURRENT_DATE - INTERVAL '1 year', 2499.00, 'ELECTRONICS', 'GOOD'),
('00000000-0000-0000-0000-000000000001', 'MacBook Pro M2 - Officer 2', CURRENT_DATE - INTERVAL '6 months', 2499.00, 'ELECTRONICS', 'EXCELLENT'),
('00000000-0000-0000-0000-000000000001', 'Polycom Conference Camera', CURRENT_DATE - INTERVAL '2 years', 850.00, 'ELECTRONICS', 'FAIR'),
('00000000-0000-0000-0000-000000000001', 'Executive Board Table', CURRENT_DATE - INTERVAL '4 years', 1200.00, 'FURNITURE', 'GOOD'),
('00000000-0000-0000-0000-000000000001', 'Herman Miller Chairs x6', CURRENT_DATE - INTERVAL '1 year', 4200.00, 'FURNITURE', 'EXCELLENT')
ON CONFLICT DO NOTHING;
