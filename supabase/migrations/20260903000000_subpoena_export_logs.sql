-- Migration for Automated "Profanity/Harassment" Automated Subpoena Data Export (#4988)

CREATE TABLE IF NOT EXISTS public.subpoena_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    date_range_start TIMESTAMPTZ NOT NULL,
    date_range_end TIMESTAMPTZ NOT NULL,
    export_hash TEXT NOT NULL, -- Cryptographic hash of the exported zip for chain-of-custody
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.subpoena_export_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can insert or view
CREATE POLICY "Admins can manage subpoena logs" 
ON public.subpoena_export_logs 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role
    )
);
