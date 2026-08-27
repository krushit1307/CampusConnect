-- Migration: 20260912100000_accessibility_reports_extensions.sql
-- Description: Extends accessibility_reports to support crowdsourced broken feature condition tracking, photo uploads, and RLS overrides.

-- 1. Add feature_type, status, verified, photo_url, and user_id columns
ALTER TABLE public.accessibility_reports
ADD COLUMN IF NOT EXISTS feature_type TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reported_broken'
    CHECK (status IN ('reported_broken', 'repaired', 'verified_broken', 'investigating')),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Trigger to automatically synchronize reporter_id and user_id fields
CREATE OR REPLACE FUNCTION public.sync_accessibility_reporter_user_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Default to auth.uid() if user_id or reporter_id are missing
        IF NEW.user_id IS NULL THEN
            NEW.user_id := auth.uid();
        END IF;
        IF NEW.reporter_id IS NULL THEN
            NEW.reporter_id := NEW.user_id;
        END IF;
        -- Maintain alignment
        IF NEW.reporter_id IS DISTINCT FROM NEW.user_id THEN
            NEW.reporter_id := NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_accessibility_reporter_user_ids ON public.accessibility_reports;
CREATE TRIGGER trg_sync_accessibility_reporter_user_ids
BEFORE INSERT ON public.accessibility_reports
FOR EACH ROW EXECUTE FUNCTION public.sync_accessibility_reporter_user_ids();

-- 3. Adjust RLS Policies to allow anyone to select reports (viewing warning labels)
DROP POLICY IF EXISTS "System admins can view reports." ON public.accessibility_reports;
DROP POLICY IF EXISTS "Anyone can view accessibility reports." ON public.accessibility_reports;

CREATE POLICY "Anyone can view accessibility reports."
ON public.accessibility_reports
FOR SELECT TO authenticated
USING (true);

-- 4. Policy to allow inserting reports
DROP POLICY IF EXISTS "Authenticated users can submit reports." ON public.accessibility_reports;
CREATE POLICY "Authenticated users can submit reports."
ON public.accessibility_reports
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. Policy to allow system admins or club admins to update reports (marking as repaired)
DROP POLICY IF EXISTS "Admins can update reports." ON public.accessibility_reports;
CREATE POLICY "Admins can update reports."
ON public.accessibility_reports
FOR UPDATE TO authenticated
USING (
    public.is_system_admin() OR
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
)
WITH CHECK (
    public.is_system_admin() OR
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
);
