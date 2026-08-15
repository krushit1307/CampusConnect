-- =============================================================================
-- Migration: Club Application & Tryout Workflow (ATS)
-- Issue: #2978 - Build a 'Club Application & Tryout' Workflow
-- Description: Creates the schema for managing club recruitment pipelines.
-- Includes tables for applications, custom form schemas, and interview slots.
-- Optimized for high-volume submission spikes near deadlines.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Application Forms (Custom questions defined by the club)
CREATE TABLE IF NOT EXISTS public.application_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,
    -- Array of question objects
    deadline TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 2. Applications (Submissions from students)
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES public.application_forms(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'applied' CHECK (
        status IN (
            'applied',
            'review',
            'interview',
            'accepted',
            'rejected'
        )
    ),
    reviewer_notes TEXT,
    is_blind_review BOOLEAN NOT NULL DEFAULT FALSE,
    -- Hides PII from reviewers if true
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, user_id) -- Prevent duplicate submissions
);
-- Index for fast Kanban board loading
CREATE INDEX IF NOT EXISTS idx_applications_club_status ON public.applications(club_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_form ON public.applications(form_id);
-- 3. Interview Slots
CREATE TABLE IF NOT EXISTS public.interview_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    interviewer_id UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        application_id UUID REFERENCES public.applications(id) ON DELETE
    SET NULL,
        -- Null if unbooked
        location TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_time_order CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_interview_slots_club_time ON public.interview_slots(club_id, start_time);
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
-- Anyone can view active forms to apply
CREATE POLICY "Anyone can view active forms" ON public.application_forms FOR
SELECT USING (
        is_active = TRUE
        AND deadline > NOW()
    );
-- Club admins can manage their forms
CREATE POLICY "Admins can manage forms" ON public.application_forms FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = application_forms.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
);
-- Students can insert their own application and view it
CREATE POLICY "Students can manage own applications" ON public.applications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Club admins can view and update all applications for their club
CREATE POLICY "Admins can manage club applications" ON public.applications FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = applications.club_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
    )
);
-- Interview slots RLS
CREATE POLICY "Users can view available slots" ON public.interview_slots FOR
SELECT USING (
        application_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.applications a
            WHERE a.id = interview_slots.application_id
                AND a.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.club_members cm
            WHERE cm.club_id = interview_slots.club_id
                AND cm.user_id = auth.uid()
                AND cm.role = 'admin'
        )
    );
CREATE POLICY "Students can book own slots" ON public.interview_slots FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.applications a
            WHERE a.id = interview_slots.application_id
                AND a.user_id = auth.uid()
        )
    );
