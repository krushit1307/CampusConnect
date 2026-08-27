-- =============================================================================
-- Migration: Role-Based Content Moderation Queues
-- Issue: #3321 - Implement 'Role-Based Content Moderation Queues'
-- Description: Updates the reports table to include categories and severity levels.
-- Adds granular moderation permissions to user roles to compartmentalize 
-- the moderation workflow (e.g., Spam vs Safety teams).
-- =============================================================================
-- 1. Create Report Category Enum
CREATE TYPE report_category AS ENUM (
    'spam',
    'harassment',
    'misinformation',
    'danger',
    'copyright',
    'other'
);
-- 2. Update Reports Table
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS category report_category NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS severity INT NOT NULL DEFAULT 1 CHECK (
        severity >= 1
        AND severity <= 5
    ),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'under_review',
            'resolved',
            'dismissed'
        )
    ),
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE
SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_reports_category_status ON public.reports(category, status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON public.reports(severity DESC);
-- 3. Add Granular Moderation Permissions to User Roles
-- Assuming a `user_roles` or `profiles` table exists with a permissions array or JSONB
-- For this migration, we'll add specific boolean flags to the profiles table for simplicity
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_moderate_spam BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_moderate_safety BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_moderate_all BOOLEAN DEFAULT FALSE;
-- Superadmin override
COMMENT ON COLUMN public.profiles.can_moderate_spam IS 'Allows user to view and resolve Spam/Copyright reports.';
COMMENT ON COLUMN public.profiles.can_moderate_safety IS 'Allows user to view and resolve Harassment/Danger reports.';
-- 4. Row Level Security (RLS) for Reports
-- Users can only see reports they are authorized to moderate
DROP POLICY IF EXISTS "Moderators can view reports" ON public.reports;
CREATE POLICY "Moderators can view authorized reports" ON public.reports FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
                AND (
                    p.can_moderate_all = TRUE
                    OR (
                        p.can_moderate_spam = TRUE
                        AND reports.category IN ('spam', 'copyright', 'misinformation', 'other')
                    )
                    OR (
                        p.can_moderate_safety = TRUE
                        AND reports.category IN ('harassment', 'danger')
                    )
                )
        )
    );
-- Moderators can update reports they are authorized to see
DROP POLICY IF EXISTS "Moderators can update reports" ON public.reports;
CREATE POLICY "Moderators can update authorized reports" ON public.reports FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
                AND (
                    p.can_moderate_all = TRUE
                    OR (
                        p.can_moderate_spam = TRUE
                        AND reports.category IN ('spam', 'copyright', 'misinformation', 'other')
                    )
                    OR (
                        p.can_moderate_safety = TRUE
                        AND reports.category IN ('harassment', 'danger')
                    )
                )
        )
    );
