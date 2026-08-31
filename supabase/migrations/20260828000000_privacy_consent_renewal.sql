-- Migration for Automated "Data Privacy" Consent Renewal (#4428)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS privacy_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS privacy_policy_version INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.privacy_consent_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_version INT NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address_hash TEXT NOT NULL,
    legal_audit_hash TEXT NOT NULL
);

ALTER TABLE public.privacy_consent_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own consent audits"
    ON public.privacy_consent_audits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own consent audits"
    ON public.privacy_consent_audits FOR SELECT
    USING (auth.uid() = user_id);

-- RPC for securely accepting the privacy policy and hashing IP
CREATE OR REPLACE FUNCTION public.accept_privacy_policy(p_policy_version INT)
RETURNS void AS $$
DECLARE
    client_ip TEXT;
    audit_hash TEXT;
BEGIN
    -- Extract IP from Supabase request headers
    client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF client_ip IS NULL THEN
        client_ip := 'unknown';
    END IF;

    -- Generate a cryptographic hash of IP + Timestamp + UID for non-repudiation
    audit_hash := encode(digest(client_ip || NOW()::TEXT || auth.uid()::TEXT, 'sha256'), 'hex');

    -- 1. Update the user's profile
    UPDATE public.profiles
    SET privacy_consent_date = NOW(),
        privacy_policy_version = p_policy_version
    WHERE id = auth.uid();

    -- 2. Create the immutable audit log
    INSERT INTO public.privacy_consent_audits (
        user_id, 
        policy_version, 
        consented_at, 
        ip_address_hash, 
        legal_audit_hash
    ) VALUES (
        auth.uid(), 
        p_policy_version, 
        NOW(), 
        encode(digest(client_ip, 'sha256'), 'hex'), 
        audit_hash
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
