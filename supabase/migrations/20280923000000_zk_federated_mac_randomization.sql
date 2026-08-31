-- Migration for Dynamic "Multi-Campus" MAC Randomization Supporter (Zero-Knowledge Identity Federation) #5143

CREATE TABLE IF NOT EXISTS zk_federation_trust_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id VARCHAR(255) NOT NULL UNIQUE,
  institution_name VARCHAR(255) NOT NULL,
  public_key_pem TEXT NOT NULL,
  commitment_root_hash VARCHAR(64) NOT NULL,
  zk_circuit_id VARCHAR(255) NOT NULL DEFAULT 'eduroam-zkp-v1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zk_anonymous_mac_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  host_campus_id VARCHAR(255) NOT NULL REFERENCES zk_federation_trust_anchors(campus_id),
  assigned_mac_address VARCHAR(17) NOT NULL,
  previous_mac_addresses TEXT[] DEFAULT '{}',
  nullifier_hash VARCHAR(64) NOT NULL UNIQUE,
  anonymous_vlan_id INTEGER NOT NULL DEFAULT 100,
  is_authorized BOOLEAN NOT NULL DEFAULT true,
  session_token TEXT NOT NULL,
  traffic_bytes BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  last_rotation_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zk_proof_audit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nullifier_hash VARCHAR(64) NOT NULL REFERENCES zk_anonymous_mac_sessions(nullifier_hash) ON DELETE CASCADE,
  host_campus_id VARCHAR(255) NOT NULL,
  verification_status VARCHAR(50) NOT NULL CHECK (verification_status IN ('VERIFIED', 'REJECTED', 'DOUBLE_SPEND_DETECTED')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE zk_federation_trust_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE zk_anonymous_mac_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zk_proof_audit_ledger ENABLE ROW LEVEL SECURITY;

-- Public read access for active trust anchors
CREATE POLICY "Allow public read access to active trust anchors"
  ON zk_federation_trust_anchors FOR SELECT
  USING (is_active = true);

-- Service role full access policies
CREATE POLICY "Allow service role full access on zk_federation_trust_anchors"
  ON zk_federation_trust_anchors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on zk_anonymous_mac_sessions"
  ON zk_anonymous_mac_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on zk_proof_audit_ledger"
  ON zk_proof_audit_ledger FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zk_trust_anchors_campus ON zk_federation_trust_anchors(campus_id);
CREATE INDEX IF NOT EXISTS idx_zk_mac_sessions_mac ON zk_anonymous_mac_sessions(assigned_mac_address);
CREATE INDEX IF NOT EXISTS idx_zk_mac_sessions_nullifier ON zk_anonymous_mac_sessions(nullifier_hash);
