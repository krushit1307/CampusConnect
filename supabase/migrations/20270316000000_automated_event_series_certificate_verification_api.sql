-- Migration: 20270316000000_automated_event_series_certificate_verification_api.sql
-- Description: Schema, verified_certificates table, and verification log stored procedures for Cryptographic Certificate Verification (#4261)

-- 1. Create verified_certificates table
CREATE TABLE IF NOT EXISTS verified_certificates (
  id VARCHAR(100) PRIMARY KEY, -- e.g., 'cert_8f92a1b'
  student_name VARCHAR(255) NOT NULL,
  student_id UUID NOT NULL,
  event_series_title VARCHAR(255) NOT NULL,
  hosting_club_name VARCHAR(255) NOT NULL,
  completion_date DATE NOT NULL,
  cryptographic_hash VARCHAR(256) NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by UUID string
CREATE INDEX IF NOT EXISTS idx_verified_certificates_id ON verified_certificates(id);

-- 2. Create certificate_verification_logs table for employer access tracking
CREATE TABLE IF NOT EXISTS certificate_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id VARCHAR(100) NOT NULL REFERENCES verified_certificates(id) ON DELETE CASCADE,
  verifier_organization VARCHAR(255) DEFAULT 'Public / Employer',
  verifier_ip VARCHAR(100),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for student notification queries
CREATE INDEX IF NOT EXISTS idx_certificate_verification_logs_cert ON certificate_verification_logs(certificate_id);

-- 3. Stored Procedure: Public Cryptographic Certificate Lookup & Log Access
CREATE OR REPLACE FUNCTION verify_campus_certificate(
  p_certificate_id VARCHAR(100),
  p_verifier_org VARCHAR(255) DEFAULT 'Employer / Third Party'
)
RETURNS TABLE (
  is_valid BOOLEAN,
  certificate_id VARCHAR(100),
  student_name VARCHAR(255),
  event_series_title VARCHAR(255),
  hosting_club_name VARCHAR(255),
  completion_date DATE,
  cryptographic_hash VARCHAR(256),
  verification_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cert RECORD;
  v_msg TEXT;
BEGIN
  SELECT * INTO v_cert FROM verified_certificates WHERE id = p_certificate_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      p_certificate_id, 
      NULL::VARCHAR, 
      NULL::VARCHAR, 
      NULL::VARCHAR, 
      NULL::DATE, 
      NULL::VARCHAR, 
      'INVALID CERTIFICATE: No record found with the provided UUID credential string.'::TEXT;
    RETURN;
  END IF;

  IF v_cert.is_revoked THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_cert.id, 
      v_cert.student_name, 
      v_cert.event_series_title, 
      v_cert.hosting_club_name, 
      v_cert.completion_date, 
      v_cert.cryptographic_hash, 
      'REVOKED CERTIFICATE: This credential has been revoked by campus administrators.'::TEXT;
    RETURN;
  END IF;

  -- Log verification access for student alert
  INSERT INTO certificate_verification_logs (certificate_id, verifier_organization)
  VALUES (p_certificate_id, p_verifier_org);

  v_msg := 'VERIFIED. ' || v_cert.student_name || ' successfully completed the ' || v_cert.event_series_title || ' hosted by ' || v_cert.hosting_club_name || ' on ' || to_char(v_cert.completion_date, 'Month DD, YYYY') || '.';

  RETURN QUERY SELECT 
    TRUE, 
    v_cert.id, 
    v_cert.student_name, 
    v_cert.event_series_title, 
    v_cert.hosting_club_name, 
    v_cert.completion_date, 
    v_cert.cryptographic_hash, 
    v_msg;
END;
$$;
