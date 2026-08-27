-- 1. Create the vendor_contracts table
CREATE TABLE IF NOT EXISTS public.vendor_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    vendor_name VARCHAR NOT NULL,
    contract_pdf_url VARCHAR,
    expiration_date DATE NOT NULL,
    discount_terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_club_id ON public.vendor_contracts(club_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_expiration ON public.vendor_contracts(expiration_date);

-- 3. Create the RPC for the daily cron job
CREATE OR REPLACE FUNCTION public.audit_contract_expirations()
RETURNS TABLE (
    contract_id UUID,
    club_id UUID,
    club_name VARCHAR,
    vendor_name VARCHAR,
    expiration_date DATE,
    discount_terms TEXT,
    contract_pdf_url VARCHAR,
    president_email VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vc.id,
        vc.club_id,
        c.name AS club_name,
        vc.vendor_name,
        vc.expiration_date,
        vc.discount_terms,
        vc.contract_pdf_url,
        COALESCE(p.email, 'unresolved@platform.edu')::VARCHAR AS president_email
    FROM public.vendor_contracts vc
    JOIN public.clubs c ON vc.club_id = c.id
    LEFT JOIN public.profiles p ON c.created_by = p.id
    WHERE vc.expiration_date = CURRENT_DATE + INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
