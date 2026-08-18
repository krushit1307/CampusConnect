-- Migration: Club Performance Report Card Generator
-- Issue #3326

CREATE TABLE IF NOT EXISTS public.club_report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    academic_year INT NOT NULL,
    total_events INT NOT NULL DEFAULT 0,
    avg_attendance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_revenue_cents BIGINT NOT NULL DEFAULT 0,
    total_budget_spent_cents BIGINT NOT NULL DEFAULT 0,
    member_churn_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    computed_grade VARCHAR(2) NOT NULL DEFAULT 'C',
    rubric_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_storage_path TEXT,
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_club_year_report UNIQUE (club_id, academic_year)
);

-- Enable RLS
ALTER TABLE public.club_report_cards ENABLE ROW LEVEL SECURITY;

-- Auditors/Admins and Club Executives can view report cards
CREATE POLICY "Admins and Club Members can view report cards"
    ON public.club_report_cards
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'auditor')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = club_report_cards.club_id
            AND club_members.user_id = auth.uid()
        )
    );

-- Only Admins/Auditors can insert or update report cards
CREATE POLICY "Admins and Auditors can manage report cards"
    ON public.club_report_cards
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'auditor')
        )
    );

-- Indexing for fast report lookups
CREATE INDEX IF NOT EXISTS idx_club_report_cards_club ON public.club_report_cards (club_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_club_report_cards_grade ON public.club_report_cards (computed_grade);
