-- WebAuthn Passkeys Table
CREATE TABLE IF NOT EXISTS public.user_passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[] DEFAULT '{}',
    device_type TEXT DEFAULT 'singleDevice',
    backed_up BOOLEAN DEFAULT false,
    name TEXT DEFAULT 'Passkey',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Index for searching user passkeys
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);

-- Enable RLS
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

-- Policies for user_passkeys
CREATE POLICY "Users can view their own passkeys"
    ON public.user_passkeys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passkeys"
    ON public.user_passkeys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passkeys"
    ON public.user_passkeys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passkeys"
    ON public.user_passkeys FOR DELETE
    USING (auth.uid() = user_id);

-- WebAuthn Challenges Table
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON public.webauthn_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_email ON public.webauthn_challenges(email);

-- Enable RLS on challenges table
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their challenges"
    ON public.webauthn_challenges FOR ALL
    USING (auth.uid() = user_id OR email IS NOT NULL);
