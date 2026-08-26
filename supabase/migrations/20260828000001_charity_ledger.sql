-- Charity Ledger for Micro-Donations (Issue #2876)

CREATE TABLE IF NOT EXISTS public.charity_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    stripe_session_id TEXT,
    donation_amount_cents INTEGER NOT NULL CHECK (donation_amount_cents > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.charity_ledger ENABLE ROW LEVEL SECURITY;

-- Admins can read all, service role can insert
CREATE POLICY "Admins can view charity ledger" ON public.charity_ledger 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.events e ON e.club_id = cm.club_id
            WHERE e.id = charity_ledger.event_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
            AND cm.status = 'approved'
        ) OR
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.clubs c ON c.id = e.club_id
            WHERE e.id = charity_ledger.event_id
            AND c.created_by = auth.uid()
        )
    );

CREATE POLICY "Service role can insert charity ledger" ON public.charity_ledger
    FOR INSERT WITH CHECK (true); -- Usually enforced by Edge Function bypassing RLS

CREATE INDEX IF NOT EXISTS idx_charity_ledger_event_id ON public.charity_ledger(event_id);
