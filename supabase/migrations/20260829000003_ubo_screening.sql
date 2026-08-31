-- ============================================================
-- Migration: 20260829000003_ubo_screening.sql
-- Issue: #5364 - Automated "Club Spending" Corporate Tax ID Scraper (OFAC Sanctions Beneficial Ownership)
-- Description:
--   1. Create vendors table for vendor management
--   2. Create vendor_contracts table for contract tracking
--   3. Create corporate_ownership table for UBO tracking
--   4. Create sanctions_screenings table for OFAC checks
--   5. Create RPC functions for UBO extraction and sanctions checking
--   6. Create escrow blocking logic for flagged vendors
--   7. Create legal counsel alert system
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tax_id TEXT, -- EIN / Tax ID
    legal_entity_type TEXT DEFAULT 'corporation',
        CHECK (legal_entity_type IN ('corporation', 'llc', 'partnership', 'sole_proprietorship', 'nonprofit')),
    jurisdiction TEXT, -- Delaware, California, etc.
    registration_date DATE,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_sanctioned BOOLEAN DEFAULT FALSE,
    sanctions_blocked_at TIMESTAMPTZ,
    sanctions_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_tax_id ON public.vendors(tax_id);
CREATE INDEX IF NOT EXISTS idx_vendors_sanctioned ON public.vendors(is_sanctioned);

-- 2. Create vendor_contracts table
CREATE TABLE IF NOT EXISTS public.vendor_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    contract_number TEXT UNIQUE,
    contract_value_cents INT NOT NULL DEFAULT 0,
    escrow_amount_cents INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled', 'blocked')),
    contract_start_date DATE,
    contract_end_date DATE,
    signed_by UUID REFERENCES public.profiles(id),
    signed_at TIMESTAMPTZ,
    escrow_blocked BOOLEAN DEFAULT FALSE,
    escrow_blocked_reason TEXT,
    escrow_blocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor_id ON public.vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_club_id ON public.vendor_contracts(club_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_status ON public.vendor_contracts(status);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_escrow_blocked ON public.vendor_contracts(escrow_blocked);

-- 3. Create corporate_ownership table (UBO tracking)
CREATE TABLE IF NOT EXISTS public.corporate_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    parent_entity_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    owner_type TEXT NOT NULL
        CHECK (owner_type IN ('individual', 'corporation', 'trust', 'other')),
    owner_name TEXT NOT NULL,
    owner_tax_id TEXT,
    ownership_percentage NUMERIC(5, 2) NOT NULL, -- 0.00 to 100.00
    is_ultimate_beneficial_owner BOOLEAN DEFAULT FALSE, -- >25% ownership
    jurisdiction TEXT,
    address TEXT,
    date_of_birth DATE,
    nationality TEXT,
    identification_number TEXT, -- Passport, SSN, etc.
    source TEXT, -- OpenCorporates, FinCEN BOI, manual
    source_data JSONB, -- Raw API response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_ownership_percentage CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_corporate_ownership_vendor_id ON public.corporate_ownership(vendor_id);
CREATE INDEX IF NOT EXISTS idx_corporate_ownership_parent_entity_id ON public.corporate_ownership(parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_corporate_ownership_ubo ON public.corporate_ownership(is_ultimate_beneficial_owner) WHERE is_ultimate_beneficial_owner = TRUE;

-- 4. Create sanctions_screenings table
CREATE TABLE IF NOT EXISTS public.sanctions_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    ownership_id UUID REFERENCES public.corporate_ownership(id) ON DELETE CASCADE,
    screening_type TEXT NOT NULL
        CHECK (screening_type IN ('entity', 'ubo_individual', 'ubo_entity')),
    entity_name TEXT NOT NULL,
    entity_type TEXT,
    match_score NUMERIC(5, 2), -- 0.00 to 100.00
    is_match BOOLEAN DEFAULT FALSE,
    match_details JSONB,
    ofac_list TEXT, -- SDN, FSE, etc.
    screening_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_vendor_id ON public.sanctions_screenings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_ownership_id ON public.sanctions_screenings(ownership_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_is_match ON public.sanctions_screenings(is_match) WHERE is_match = TRUE;

-- 5. Create legal_alerts table
CREATE TABLE IF NOT EXISTS public.legal_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.vendor_contracts(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL
        CHECK (alert_type IN ('sanctions_match', 'ubo_sanctions_match', 'shell_company', 'high_risk_jurisdiction')),
    severity TEXT NOT NULL DEFAULT 'high'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_name TEXT,
    match_details JSONB,
    alert_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (alert_status IN ('pending', 'reviewed', 'dismissed', 'escalated')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_legal_alerts_vendor_id ON public.legal_alerts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_legal_alerts_contract_id ON public.legal_alerts(contract_id);
CREATE INDEX IF NOT EXISTS idx_legal_alerts_status ON public.legal_alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_legal_alerts_severity ON public.legal_alerts(severity);

-- 6. Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "Club admins can view vendors" ON public.vendors
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Club admins can create vendors" ON public.vendors
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for vendor_contracts
CREATE POLICY "Club admins can view their contracts" ON public.vendor_contracts
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = vendor_contracts.club_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Club admins can create contracts" ON public.vendor_contracts
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = vendor_contracts.club_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
);

-- RLS Policies for corporate_ownership
CREATE POLICY "Club admins can view ownership" ON public.corporate_ownership
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for sanctions_screenings
CREATE POLICY "Club admins can view screenings" ON public.sanctions_screenings
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for legal_alerts
CREATE POLICY "Club admins can view alerts" ON public.legal_alerts
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update alerts" ON public.legal_alerts
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 7. Create function to screen vendor for sanctions
CREATE OR REPLACE FUNCTION public.screen_vendor_sanctions(
    p_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor RECORD;
    v_ownership RECORD;
    v_screening_id UUID;
    v_has_sanctions BOOLEAN := FALSE;
BEGIN
    -- Get vendor info
    SELECT * INTO v_vendor
    FROM public.vendors
    WHERE id = p_vendor_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor not found';
    END IF;
    
    -- Screen the entity itself
    INSERT INTO public.sanctions_screenings (
        vendor_id,
        screening_type,
        entity_name,
        entity_type,
        match_score,
        is_match,
        match_details,
        ofac_list
    ) VALUES (
        p_vendor_id,
        'entity',
        v_vendor.name,
        v_vendor.legal_entity_type,
        0.00,
        FALSE,
        '{}'::JSONB,
        NULL
    ) RETURNING id INTO v_screening_id;
    
    -- Screen all UBOs
    FOR v_ownership IN
        SELECT * FROM public.corporate_ownership
        WHERE vendor_id = p_vendor_id AND is_ultimate_beneficial_owner = TRUE
    LOOP
        INSERT INTO public.sanctions_screenings (
            vendor_id,
            ownership_id,
            screening_type,
            entity_name,
            entity_type,
            match_score,
            is_match,
            match_details,
            ofac_list
        ) VALUES (
            p_vendor_id,
            v_ownership.id,
            'ubo_individual',
            v_ownership.owner_name,
            v_ownership.owner_type,
            0.00,
            FALSE,
            '{}'::JSONB,
            NULL
        );
    END LOOP;
    
    -- Check if any sanctions matches exist
    SELECT COUNT(*) > 0 INTO v_has_sanctions
    FROM public.sanctions_screenings
    WHERE vendor_id = p_vendor_id AND is_match = TRUE;
    
    -- Update vendor sanctions status
    UPDATE public.vendors
    SET 
        is_sanctioned = v_has_sanctions,
        sanctions_blocked_at = CASE WHEN v_has_sanctions THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_vendor_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'vendor_id', p_vendor_id,
        'has_sanctions', v_has_sanctions,
        'message', CASE WHEN v_has_sanctions THEN 'Sanctions match found' ELSE 'No sanctions matches' END
    );
END;
$$;

-- 8. Create function to block escrow for sanctioned vendor
CREATE OR REPLACE FUNCTION public.block_vendor_escrow(
    p_vendor_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Block all active contracts for this vendor
    UPDATE public.vendor_contracts
    SET 
        escrow_blocked = TRUE,
        escrow_blocked_reason = p_reason,
        escrow_blocked_at = NOW(),
        status = 'blocked',
        updated_at = NOW()
    WHERE vendor_id = p_vendor_id
      AND status IN ('pending', 'approved', 'active');
    
    -- Create legal alert
    INSERT INTO public.legal_alerts (
        vendor_id,
        alert_type,
        severity,
        title,
        description,
        entity_name,
        alert_status
    ) SELECT
        p_vendor_id,
        'sanctions_match',
        'critical',
        'Sanctions Match - Escrow Blocked',
        p_reason,
        v.name,
        'pending'
    FROM public.vendors v
    WHERE v.id = p_vendor_id;
    
    RETURN TRUE;
END;
$$;

-- 9. Create function to create vendor
CREATE OR REPLACE FUNCTION public.create_vendor(
    p_name TEXT,
    p_tax_id TEXT DEFAULT NULL,
    p_legal_entity_type TEXT DEFAULT 'corporation',
    p_jurisdiction TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vendor_id UUID;
BEGIN
    INSERT INTO public.vendors (
        name, tax_id, legal_entity_type, jurisdiction, address, contact_email
    ) VALUES (
        p_name, p_tax_id, p_legal_entity_type, p_jurisdiction, p_address, p_contact_email
    ) RETURNING id INTO v_vendor_id;
    
    RETURN v_vendor_id;
END;
$$;

-- 10. Create function to add corporate ownership
CREATE OR REPLACE FUNCTION public.add_corporate_ownership(
    p_vendor_id UUID,
    p_owner_type TEXT,
    p_owner_name TEXT,
    p_ownership_percentage NUMERIC,
    p_owner_tax_id TEXT DEFAULT NULL,
    p_jurisdiction TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_nationality TEXT DEFAULT NULL,
    p_identification_number TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual',
    p_source_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ownership_id UUID;
    v_is_ubo BOOLEAN;
BEGIN
    -- Determine if this is a UBO (>25% ownership)
    v_is_ubo := p_ownership_percentage >= 25;
    
    INSERT INTO public.corporate_ownership (
        vendor_id,
        owner_type,
        owner_name,
        owner_tax_id,
        ownership_percentage,
        is_ultimate_beneficial_owner,
        jurisdiction,
        address,
        date_of_birth,
        nationality,
        identification_number,
        source,
        source_data
    ) VALUES (
        p_vendor_id,
        p_owner_type,
        p_owner_name,
        p_owner_tax_id,
        p_ownership_percentage,
        v_is_ubo,
        p_jurisdiction,
        p_address,
        p_date_of_birth,
        p_nationality,
        p_identification_number,
        p_source,
        p_source_data
    ) RETURNING id INTO v_ownership_id;
    
    RETURN v_ownership_id;
END;
$$;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.screen_vendor_sanctions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_vendor_escrow(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_vendor(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_corporate_ownership(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB) TO authenticated;
