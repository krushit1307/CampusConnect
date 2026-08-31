-- Migration: 20280908000000_wifi_certificates.sql
-- Description: Create table for tracking Wi-Fi EAP-TLS client certificates generated for multi-campus network roaming

CREATE TABLE IF NOT EXISTS public.wifi_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_campus TEXT NOT NULL,
    cert_serial TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.wifi_certificates ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Allow select on own wifi certificates"
    ON public.wifi_certificates FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Insert policies
CREATE POLICY "Allow insert on own wifi certificates"
    ON public.wifi_certificates FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
