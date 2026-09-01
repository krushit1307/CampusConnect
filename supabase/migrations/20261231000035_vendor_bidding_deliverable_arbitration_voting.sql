-- Migration: Decentralized Vendor Deliverable Arbitration & Jury Voting Court
-- Handles blind jury voting, conflict-of-interest filters, majority state machine, and escrow settlement.

CREATE TABLE IF NOT EXISTS vendor_dispute_cases (
    id VARCHAR(128) PRIMARY KEY,
    contract_id VARCHAR(128) NOT NULL,
    deliverable_title VARCHAR(255) NOT NULL,
    escrow_amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    vendor_id VARCHAR(128) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_evidence_photo_url TEXT NOT NULL,
    vendor_evidence_statement TEXT NOT NULL,
    organizer_club_id VARCHAR(128) NOT NULL,
    organizer_club_name VARCHAR(255) NOT NULL,
    organizer_complaint_statement TEXT NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'JURY_DELIBERATION',
    is_escrow_frozen BOOLEAN NOT NULL DEFAULT TRUE,
    payout_vendor_votes_count INT NOT NULL DEFAULT 0,
    refund_club_votes_count INT NOT NULL DEFAULT 0,
    majority_threshold INT NOT NULL DEFAULT 3,
    resolution_tx_hash VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_dispute_jurors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id VARCHAR(128) REFERENCES vendor_dispute_cases(id) ON DELETE CASCADE,
    admin_id VARCHAR(128) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    club_affiliation VARCHAR(255) NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    vote_cast_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_blind_arbitration_votes (
    id VARCHAR(128) PRIMARY KEY,
    dispute_id VARCHAR(128) REFERENCES vendor_dispute_cases(id) ON DELETE CASCADE,
    jury_admin_id VARCHAR(128) NOT NULL,
    choice VARCHAR(32) NOT NULL, -- 'PAYOUT_VENDOR' | 'REFUND_CLUB'
    voting_hash VARCHAR(128) NOT NULL, -- SHA256 commitment
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_cases_status ON vendor_dispute_cases(status, is_escrow_frozen);
CREATE INDEX IF NOT EXISTS idx_dispute_jurors ON vendor_dispute_jurors(dispute_id, admin_id);
