-- =============================================================================
-- Migration: Custom Interactive Badges (Badge Studio)
-- Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
-- Description: Creates the gamification_badges table so Student Union admins
-- can visually compose new badges (shape + gradient + icon + ribbon text) and
-- publish them dynamically, without a code deployment. The composition is
-- stored strictly as JSON (never raw SVG/XML) to prevent XSS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gamification_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    svg_payload_json JSONB NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_badges_published ON public.gamification_badges(is_published);

ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can view published badges (so they render on public profiles)
CREATE POLICY "Anyone can view published badges" ON public.gamification_badges
    FOR SELECT USING (is_published = TRUE);

-- Platform admins (Student Union) can fully manage all badges, including drafts
CREATE POLICY "Admins can manage gamification badges" ON public.gamification_badges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );