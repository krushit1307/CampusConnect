-- ============================================================
-- Migration: Blockchain immutable certificate ledger (#1041)
-- Description:
--  1. Adds blockchain anchoring columns to the certificates table
--     (leaf hash, Merkle root/path, anchor day, tx/block refs).
--  2. Creates certificate_ledger_anchors, a service-side registry of
--     days already anchored to the CertificateLedger contract so the
--     daily worker is idempotent and never double-anchors a day.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Certificate anchoring columns
-- ------------------------------------------------------------

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS verification_hash TEXT;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS merkle_root TEXT;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS merkle_path JSONB;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS anchor_day DATE;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS anchor_tx_hash TEXT;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS anchor_block BIGINT;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS verify_url TEXT;

COMMENT ON COLUMN certificates.verification_hash IS
'keccak256 leaf hash of the certificate record (canonical, see shared/merkle.ts).';

COMMENT ON COLUMN certificates.merkle_root IS
'Merkle root of the daily batch this certificate was anchored in.';

COMMENT ON COLUMN certificates.merkle_path IS
'JSON { path: string[], leaf_index: number } Merkle proof of this certificate leaf.';

COMMENT ON COLUMN certificates.anchor_day IS
'UTC day (DATE) the certificate batch was anchored to the blockchain.';

COMMENT ON COLUMN certificates.anchor_tx_hash IS
'On-chain transaction hash of the anchorDay call.';

COMMENT ON COLUMN certificates.anchor_block IS
'On-chain block number of the anchorDay call.';

COMMENT ON COLUMN certificates.verify_url IS
'Public proof URL (e.g. /verify?cert=<id>) for employers to verify authenticity.';

-- ------------------------------------------------------------
-- 2. Anchored-day registry (service-side, idempotency)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS certificate_ledger_anchors (
  day DATE PRIMARY KEY,
  merkle_root TEXT NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  cert_count INTEGER NOT NULL DEFAULT 0,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE certificate_ledger_anchors ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE certificate_ledger_anchors IS
'Registry of UTC days already anchored to the CertificateLedger contract.';

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS certificates_verification_hash_idx
ON certificates (verification_hash)
WHERE verification_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS certificates_anchor_day_idx
ON certificates (anchor_day)
WHERE anchor_day IS NOT NULL;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
