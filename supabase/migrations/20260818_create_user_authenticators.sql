-- Create user authenticators table for storing WebAuthn public keys & counters
CREATE TABLE IF NOT EXISTS public.user_authenticators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Index for quick lookup during authentication assertions
CREATE INDEX idx_user_authenticators_user_id ON public.user_authenticators(user_id);
CREATE INDEX idx_user_authenticators_credential_id ON public.user_authenticators(credential_id);

-- Enable RLS on user_authenticators
ALTER TABLE public.user_authenticators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own authenticators" 
    ON public.user_authenticators FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own authenticators" 
    ON public.user_authenticators FOR DELETE 
    USING (auth.uid() = user_id);

-- Create Recovery Table for Lost Keys Workflow
CREATE TABLE IF NOT EXISTS public.webauthn_recovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    notes TEXT,
    verified_by_student_union_id UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE public.webauthn_recovery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own recovery request" 
    ON public.webauthn_recovery_requests FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own recovery requests" 
    ON public.webauthn_recovery_requests FOR SELECT 
    USING (auth.uid() = user_id);
