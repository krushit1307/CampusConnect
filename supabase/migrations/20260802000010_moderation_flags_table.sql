-- =============================================================================
-- Migration: 20260802000010_moderation_flags_table.sql
-- Purpose: Track repeated profanity violations for automated moderation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL DEFAULT 'profanity',
    flagged_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    is_resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_id ON public.moderation_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_created_at ON public.moderation_flags(created_at);

ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

-- Users can only see their own flags
CREATE POLICY "Users can view their own moderation flags"
ON public.moderation_flags
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can review and resolve flags
CREATE POLICY "Admins can manage all moderation flags"
ON public.moderation_flags
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('club_admin', 'system_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('club_admin', 'system_admin')
    )
);