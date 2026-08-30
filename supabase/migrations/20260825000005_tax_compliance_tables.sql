-- Migration: 20260825000005_tax_compliance_tables.sql
-- Purpose: Add tax profile and 990-N filing tracking for clubs.

CREATE TABLE IF NOT EXISTS club_tax_profiles (
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE PRIMARY KEY,
    legal_name TEXT NOT NULL,
    ein TEXT NOT NULL CHECK (ein ~ '^[0-9]{2}-[0-9]{7}$'),
    principal_officer_name TEXT NOT NULL,
    principal_officer_email TEXT NOT NULL,
    mailing_address TEXT NOT NULL,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_990n_filings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    gross_receipts NUMERIC NOT NULL,
    filed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'filed', 'rejected'))
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_club_tax_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_club_tax_profiles_updated_at ON club_tax_profiles;
CREATE TRIGGER update_club_tax_profiles_updated_at
BEFORE UPDATE ON club_tax_profiles
FOR EACH ROW
EXECUTE FUNCTION update_club_tax_profiles_updated_at();
