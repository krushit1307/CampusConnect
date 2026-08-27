-- ============================================================
-- Migration: Secure Document Watermarking Pipeline (Issue #3343)
--
-- Forensics audit trail table and logging RPC for tracking dynamic
-- PDF watermarking downloads by user email and timestamp.
-- ============================================================

-- ── Step 1: Create document_watermark_logs table ──────────────
CREATE TABLE IF NOT EXISTS public.document_watermark_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    watermark_text TEXT NOT NULL,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user and file audit lookups
CREATE INDEX IF NOT EXISTS idx_watermark_logs_user_file
    ON public.document_watermark_logs (user_id, file_id);

CREATE INDEX IF NOT EXISTS idx_watermark_logs_downloaded
    ON public.document_watermark_logs (downloaded_at);

-- Enable RLS
ALTER TABLE public.document_watermark_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own watermark logs." ON public.document_watermark_logs;
CREATE POLICY "Users can view their own watermark logs."
ON public.document_watermark_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert watermark logs." ON public.document_watermark_logs;
CREATE POLICY "Users can insert watermark logs."
ON public.document_watermark_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to document_watermark_logs." ON public.document_watermark_logs;
CREATE POLICY "Service role has full access to document_watermark_logs."
ON public.document_watermark_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ── Step 2: RPC to log document watermark audit entry ────────
CREATE OR REPLACE FUNCTION public.log_document_watermark(
    p_file_id TEXT,
    p_file_name TEXT,
    p_user_email TEXT,
    p_watermark_text TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_log_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User authentication required.');
    END IF;

    INSERT INTO public.document_watermark_logs (
        user_id,
        file_id,
        file_name,
        user_email,
        watermark_text,
        downloaded_at
    ) VALUES (
        v_user_id,
        p_file_id,
        p_file_name,
        p_user_email,
        p_watermark_text,
        NOW()
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_log_id,
        'user_email', p_user_email,
        'downloaded_at', NOW(),
        'message', 'Forensic watermark download logged successfully.'
    );
END;
$$;

COMMENT ON TABLE public.document_watermark_logs IS
'Audit log tracing dynamic forensic watermarking PDF downloads back to specific user emails and timestamps.';

COMMENT ON FUNCTION public.log_document_watermark(TEXT, TEXT, TEXT, TEXT) IS
'Logs a forensic PDF watermark download audit record for leak tracing.';
