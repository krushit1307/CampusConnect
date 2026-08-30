CREATE TABLE IF NOT EXISTS public.impeachment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(club_id, target_user_id, voter_user_id)
);

ALTER TABLE public.impeachment_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view impeachment votes for their clubs"
ON public.impeachment_votes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = impeachment_votes.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

CREATE TABLE IF NOT EXISTS public.governance_challenges (
    challenge TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.governance_challenges ENABLE ROW LEVEL SECURITY;
-- No policies needed for governance_challenges, as it is only accessed via Edge Function (Service Role)
