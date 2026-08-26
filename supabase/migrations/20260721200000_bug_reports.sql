-- ============================================================
-- Migration: 20260721200000_bug_reports.sql
-- Description:
-- Adds a bug_reports table so authenticated users can submit
-- UI bug feedback, plus a bug-screenshots storage bucket.
-- ============================================================

-- ------------------------------------------------------------
-- Create bug_reports table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE CASCADE,

    description TEXT NOT NULL
        CHECK (length(trim(description)) > 0 AND length(description) <= 2000),

    screenshot_url TEXT,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id
ON bug_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status
ON bug_reports(status);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at
ON bug_reports(created_at DESC);

-- ------------------------------------------------------------
-- Enable Row Level Security
-- ------------------------------------------------------------

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------

-- Only admins can view all bug reports
DROP POLICY IF EXISTS "Admins can read all bug reports" ON bug_reports;
CREATE POLICY "Admins can read all bug reports"
ON bug_reports
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'system_admin'
    )
);

-- Users can view their own bug reports
DROP POLICY IF EXISTS "Users can read own bug reports" ON bug_reports;
CREATE POLICY "Users can read own bug reports"
ON bug_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert bug reports
DROP POLICY IF EXISTS "Authenticated users can submit bug reports" ON bug_reports;
CREATE POLICY "Authenticated users can submit bug reports"
ON bug_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can update bug report status
DROP POLICY IF EXISTS "Admins can update bug reports" ON bug_reports;
CREATE POLICY "Admins can update bug reports"
ON bug_reports
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'system_admin'
    )
);

-- ------------------------------------------------------------
-- Storage: bug-screenshots bucket
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bug-screenshots',
    'bug-screenshots',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT DO NOTHING;

-- Authenticated users can upload screenshots to their own folder
DROP POLICY IF EXISTS "Authenticated users can upload bug screenshots"
ON storage.objects;
CREATE POLICY "Authenticated users can upload bug screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'bug-screenshots'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view bug screenshots
DROP POLICY IF EXISTS "Public Access Bug Screenshots" ON storage.objects;
CREATE POLICY "Public Access Bug Screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bug-screenshots');

-- Users can delete their own bug screenshots
DROP POLICY IF EXISTS "Users can delete own bug screenshots" ON storage.objects;
CREATE POLICY "Users can delete own bug screenshots"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'bug-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
