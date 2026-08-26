-- Migration: 20270315000000_automated_club_spending_receipt_ocr.sql
-- Description: Schema and audit table for Automated Club Spending Receipt OCR & Ledger Integration (#4267)

-- 1. Create club_receipt_ocr_logs table for OCR audit tracking
CREATE TABLE IF NOT EXISTS club_receipt_ocr_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL,
  treasurer_id UUID NOT NULL,
  receipt_image_url TEXT NOT NULL,
  extracted_vendor_name VARCHAR(255),
  extracted_total_amount DECIMAL(12, 2),
  extracted_date DATE,
  raw_textract_response JSONB,
  audit_status VARCHAR(50) NOT NULL DEFAULT 'OCR_VERIFIED', -- 'OCR_VERIFIED', 'MANUALLY_OVERRIDDEN'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for treasurer ledger lookup
CREATE INDEX IF NOT EXISTS idx_club_receipt_ocr_club ON club_receipt_ocr_logs(club_id);

-- 2. Stored Procedure: Log OCR Analyzed Receipt & Pre-fill Ledger Entry
CREATE OR REPLACE FUNCTION log_club_receipt_ocr(
  p_club_id UUID,
  p_treasurer_id UUID,
  p_receipt_image_url TEXT,
  p_vendor_name VARCHAR(255),
  p_total_amount DECIMAL(12, 2),
  p_extracted_date DATE,
  p_raw_json JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO club_receipt_ocr_logs (
    club_id,
    treasurer_id,
    receipt_image_url,
    extracted_vendor_name,
    extracted_total_amount,
    extracted_date,
    raw_textract_response,
    audit_status
  )
  VALUES (
    p_club_id,
    p_treasurer_id,
    p_receipt_image_url,
    p_vendor_name,
    p_total_amount,
    p_extracted_date,
    p_raw_json,
    'OCR_VERIFIED'
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
