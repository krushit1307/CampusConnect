-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- Main escrow contracts table (ALL FIELDS INCLUDED)
CREATE TABLE IF NOT EXISTS escrow_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'FUNDED', 'RELEASED', 'REFUNDED', 'CANCELLED', 'EXPIRED')),
    
    -- Club Details
    club_id UUID NOT NULL,
    club_name VARCHAR(255) NOT NULL,
    club_contact_email VARCHAR(255) NOT NULL,
    organizer_name VARCHAR(255) NOT NULL,
    organizer_email VARCHAR(255) NOT NULL,
    
    -- Speaker Details
    speaker_id UUID,
    speaker_name VARCHAR(255) NOT NULL,
    speaker_email VARCHAR(255) NOT NULL,
    speaker_phone VARCHAR(50),
    speaker_company VARCHAR(255),
    speaker_bio TEXT,
    speaker_stripe_account_id VARCHAR(255),
    
    -- Event Details
    event_name VARCHAR(255) NOT NULL,
    event_description TEXT,
    event_date TIMESTAMP NOT NULL,
    event_location VARCHAR(255),
    event_time_start TIME,
    event_time_end TIME,
    
    -- Payment Details
    honorarium_amount DECIMAL(10,2) NOT NULL,
    honorarium_currency VARCHAR(3) DEFAULT 'USD',
    honorarium_tax DECIMAL(10,2) DEFAULT 0,
    honorarium_net_amount DECIMAL(10,2),
    payment_terms TEXT,
    
    -- Stripe Integration
    stripe_payment_intent_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    stripe_account_id VARCHAR(255),
    
    -- QR Code
    qr_code_data TEXT,
    qr_code_secret VARCHAR(255),
    check_in_time TIMESTAMP,
    check_in_verification_method VARCHAR(50),
    
    -- Contract Metadata
    contract_signed_date TIMESTAMP,
    agreement_terms TEXT,
    cancellation_policy TEXT,
    escrow_release_conditions TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    released_at TIMESTAMP,
    refunded_at TIMESTAMP
);

-- Transactions audit trail
CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES escrow_contracts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('DEPOSIT', 'RELEASE', 'REFUND', 'FEE', 'TAX')),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Speaker profiles
CREATE TABLE IF NOT EXISTS speaker_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    bio TEXT,
    stripe_account_id VARCHAR(255),
    stripe_account_status VARCHAR(50),
    total_earned DECIMAL(10,2) DEFAULT 0,
    total_contracts INT DEFAULT 0,
    rating FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_escrow_contracts_status ON escrow_contracts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_contracts_club_id ON escrow_contracts(club_id);
CREATE INDEX IF NOT EXISTS idx_escrow_contracts_speaker_id ON escrow_contracts(speaker_id);
CREATE INDEX IF NOT EXISTS idx_escrow_contracts_event_date ON escrow_contracts(event_date);

-- ============================================
-- 3. TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_escrow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_escrow_contracts_timestamp 
    BEFORE UPDATE ON escrow_contracts 
    FOR EACH ROW EXECUTE FUNCTION update_escrow_timestamp();

-- Auto-generate contract number
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 100000;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.contract_number = 'ESC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(CAST(NEXTVAL('contract_number_seq') AS TEXT), 6, '0');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_contract_number_trigger
    BEFORE INSERT ON escrow_contracts
    FOR EACH ROW
    WHEN (NEW.contract_number IS NULL)
    EXECUTE FUNCTION generate_contract_number();

-- Auto-calculate net amount
CREATE OR REPLACE FUNCTION calculate_net_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.honorarium_net_amount = NEW.honorarium_amount - COALESCE(NEW.honorarium_tax, 0);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_net_amount_trigger
    BEFORE INSERT OR UPDATE ON escrow_contracts
    FOR EACH ROW
    EXECUTE FUNCTION calculate_net_amount();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE escrow_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_profiles ENABLE ROW LEVEL SECURITY;

-- Club admins can view their contracts
CREATE POLICY club_view_own_contracts ON escrow_contracts
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM club_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
        OR auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin')
    );

-- Club admins can create contracts
CREATE POLICY club_create_contracts ON escrow_contracts
    FOR INSERT WITH CHECK (
        club_id IN (
            SELECT club_id FROM club_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Speaker can view their own contracts
CREATE POLICY speaker_view_own_contracts ON escrow_contracts
    FOR SELECT USING (
        speaker_id IN (
            SELECT id FROM speaker_profiles WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- 5. SAMPLE DATA (Optional - for testing)
-- ============================================

INSERT INTO speaker_profiles (full_name, email, phone, company, bio) VALUES
('John Smith', 'john.smith@example.com', '+1-555-0101', 'Tech Speakers Inc.', 'Professional speaker with 10+ years of experience in AI and Machine Learning'),
('Sarah Johnson', 'sarah.j@example.com', '+1-555-0102', 'Leadership Academy', 'Executive coach and leadership development expert');

-- ============================================
-- 6. HELPER VIEWS
-- ============================================

-- View for active contracts
CREATE OR REPLACE VIEW active_escrow_contracts AS
SELECT 
    c.*,
    s.full_name as speaker_full_name,
    s.email as speaker_email_addr,
    s.company as speaker_company_name
FROM escrow_contracts c
LEFT JOIN speaker_profiles s ON c.speaker_id = s.id
WHERE c.status IN ('PENDING', 'FUNDED');

-- View for contract summary
CREATE OR REPLACE VIEW contract_summary AS
SELECT 
    c.id,
    c.contract_number,
    c.status,
    c.event_name,
    c.event_date,
    c.club_name,
    c.speaker_name,
    c.honorarium_amount,
    c.honorarium_net_amount,
    c.created_at,
    CASE 
        WHEN c.status = 'RELEASED' THEN c.released_at
        WHEN c.status = 'REFUNDED' THEN c.refunded_at
        ELSE NULL
    END as completed_at
FROM escrow_contracts c;

-- ============================================
-- 7. USAGE EXAMPLES
-- ============================================

-- Create a new contract
/*
INSERT INTO escrow_contracts (
    club_id,
    club_name,
    club_contact_email,
    organizer_name,
    organizer_email,
    speaker_name,
    speaker_email,
    speaker_phone,
    speaker_company,
    event_name,
    event_description,
    event_date,
    event_location,
    event_time_start,
    event_time_end,
    honorarium_amount,
    honorarium_tax,
    payment_terms,
    agreement_terms
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Tech Club',
    'techclub@university.edu',
    'Alice Organizer',
    'alice@university.edu',
    'Dr. Jane Speaker',
    'jane@speaker.com',
    '+1-555-0103',
    'AI Innovations Corp',
    'Future of AI in Education',
    'Join us for an exciting talk on AI applications in education',
    '2026-09-15 18:00:00',
    'Main Hall, Building A',
    '18:00',
    '20:00',
    500.00,
    25.00,
    'Payment within 30 days of event',
    'Standard speaker agreement terms apply'
);
*/

-- Check in a speaker
/*
UPDATE escrow_contracts 
SET 
    check_in_time = CURRENT_TIMESTAMP,
    check_in_verification_method = 'QR_SCAN',
    status = 'FUNDED'
WHERE id = 'contract_id_here';
*/

-- Release funds
/*
UPDATE escrow_contracts 
SET 
    status = 'RELEASED',
    released_at = CURRENT_TIMESTAMP
WHERE id = 'contract_id_here';
*/

-- ============================================
-- 8. CLEANUP (if needed)
-- ============================================

/*
DROP VIEW IF EXISTS contract_summary;
DROP VIEW IF EXISTS active_escrow_contracts;
DROP TABLE IF EXISTS escrow_transactions;
DROP TABLE IF EXISTS escrow_contracts;
DROP TABLE IF EXISTS speaker_profiles;
DROP SEQUENCE IF EXISTS contract_number_seq;
*/
