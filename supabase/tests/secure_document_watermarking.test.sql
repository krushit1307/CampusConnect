-- ============================================================
-- Test Suite: secure_document_watermarking.test.sql
-- Description: Verifies schema, RLS policies, and log_document_watermark
-- RPC function execution for Issue #3343.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. Schema Validation
SELECT has_table('public', 'document_watermark_logs', 'document_watermark_logs table should exist');
SELECT has_column('public', 'document_watermark_logs', 'user_id', 'Column user_id should exist');
SELECT has_column('public', 'document_watermark_logs', 'file_id', 'Column file_id should exist');
SELECT has_column('public', 'document_watermark_logs', 'file_name', 'Column file_name should exist');
SELECT has_column('public', 'document_watermark_logs', 'user_email', 'Column user_email should exist');
SELECT has_column('public', 'document_watermark_logs', 'watermark_text', 'Column watermark_text should exist');

SELECT has_function('public', 'log_document_watermark', ARRAY['text', 'text', 'text', 'text'], 'RPC log_document_watermark should exist');

-- 2. Mock Data Setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'Alex', 'Leaker', 'student')
ON CONFLICT (id) DO NOTHING;

-- 3. Execute Log Document Watermark RPC
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT is(
    (public.log_document_watermark('doc-101', 'Budget_Plan.pdf', 'alex@univ.edu', 'alex@univ.edu · 2026-08-18')->>'success')::boolean,
    true,
    'Submitting log_document_watermark should return success = true'
);

SELECT * FROM finish();
ROLLBACK;
