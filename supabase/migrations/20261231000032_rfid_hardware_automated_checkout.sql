-- Migration: RFID Automated Checkout & Loss Prevention Hardware Ledger
-- Tracks EPC Gen2 RFID tags, perimeter security gates, physical lock states, and penalties.

CREATE TABLE IF NOT EXISTS rfid_hardware_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfid_tag_epc VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    asset_tag_number VARCHAR(64) UNIQUE NOT NULL,
    serial_number VARCHAR(128) NOT NULL,
    valuation_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    location_id VARCHAR(128) NOT NULL,
    rfid_gate_id VARCHAR(128),
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfid_hardware_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES rfid_hardware_assets(id) ON DELETE CASCADE,
    student_id VARCHAR(128) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    student_id_card_number VARCHAR(64) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'reserved',
    purpose_description TEXT NOT NULL,
    approved_by_staff_id VARCHAR(128),
    checked_out_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfid_perimeter_gates (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_description TEXT NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_reason TEXT,
    last_ping_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfid_unauthorized_removal_penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(128) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    incident_type VARCHAR(64) NOT NULL DEFAULT 'unauthorized_hardware_removal',
    amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    status VARCHAR(32) NOT NULL DEFAULT 'charged',
    asset_id UUID REFERENCES rfid_hardware_assets(id),
    rfid_gate_id VARCHAR(128) REFERENCES rfid_perimeter_gates(id),
    incident_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast EPC lookup under 5ms gate read latency
CREATE INDEX IF NOT EXISTS idx_rfid_hardware_epc ON rfid_hardware_assets(rfid_tag_epc);
CREATE INDEX IF NOT EXISTS idx_rfid_bookings_asset_active ON rfid_hardware_bookings(asset_id, status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_rfid_penalties_student ON rfid_unauthorized_removal_penalties(student_id);
