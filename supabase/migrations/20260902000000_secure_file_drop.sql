-- Migration: 20260902000000_secure_file_drop.sql
-- Description: Issue #3006 - Secure File Drop for Competitions

-- 1. Add submission_deadline column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMPTZ;

-- 2. Create event_submissions table
CREATE TABLE IF NOT EXISTS public.event_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_name TEXT,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_submissions_event_id ON public.event_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_submissions_user_id ON public.event_submissions(user_id);

-- 3. Trigger Function: Enforce RSVP verification and strict deadline check
CREATE OR REPLACE FUNCTION public.enforce_event_submission_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_deadline TIMESTAMPTZ;
    v_has_rsvp BOOLEAN;
BEGIN
    -- Check if event has a submission deadline and if it has passed
    SELECT submission_deadline INTO v_deadline
    FROM public.events
    WHERE id = NEW.event_id;

    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Submissions for this event are closed as the deadline has passed (%.)', v_deadline;
    END IF;

    -- Check if submitting user has an RSVP for the event
    SELECT EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE event_id = NEW.event_id
          AND user_id = NEW.user_id
    ) INTO v_has_rsvp;

    IF NOT v_has_rsvp THEN
        RAISE EXCEPTION 'Only users with a verified RSVP for this event can submit files.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_event_submission_rules ON public.event_submissions;
CREATE TRIGGER trg_enforce_event_submission_rules
BEFORE INSERT OR UPDATE ON public.event_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_submission_rules();

-- 4. Enable Row Level Security
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Owners can view their own submissions; Event creators / Club admins can view all for their event
DROP POLICY IF EXISTS "Users can view own submissions or club admins view all" ON public.event_submissions;
CREATE POLICY "Users can view own submissions or club admins view all"
ON public.event_submissions FOR SELECT
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_submissions.event_id
          AND (
            e.created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = e.club_id
                  AND cm.user_id = auth.uid()
                  AND cm.status = 'approved'
                  AND LOWER(cm.role) IN ('admin', 'organizer', 'president', 'officer')
            ) OR
            EXISTS (
                SELECT 1 FROM public.clubs c
                WHERE c.id = e.club_id AND c.created_by = auth.uid()
            )
          )
    )
);

-- INSERT policy: Authenticated user with verified RSVP can insert their submission
DROP POLICY IF EXISTS "Users with RSVP can insert own submission" ON public.event_submissions;
CREATE POLICY "Users with RSVP can insert own submission"
ON public.event_submissions FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE event_id = event_submissions.event_id AND user_id = auth.uid()
    )
);

-- UPDATE policy: Owners can update their submission before deadline
DROP POLICY IF EXISTS "Users can update own submission before deadline" ON public.event_submissions;
CREATE POLICY "Users can update own submission before deadline"
ON public.event_submissions FOR UPDATE
USING (
    auth.uid() = user_id AND
    NOT EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_submissions.event_id
          AND e.submission_deadline IS NOT NULL
          AND NOW() > e.submission_deadline
    )
);

-- DELETE policy: Owners can delete their submission before deadline
DROP POLICY IF EXISTS "Users can delete own submission before deadline" ON public.event_submissions;
CREATE POLICY "Users can delete own submission before deadline"
ON public.event_submissions FOR DELETE
USING (
    auth.uid() = user_id AND
    NOT EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_submissions.event_id
          AND e.submission_deadline IS NOT NULL
          AND NOW() > e.submission_deadline
    )
);

-- 5. Create storage bucket for event submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-submissions', 'event-submissions', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Users can upload submission files" ON storage.objects;
CREATE POLICY "Users can upload submission files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'event-submissions' AND
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users and organizers can view submission files" ON storage.objects;
CREATE POLICY "Users and organizers can view submission files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'event-submissions' AND
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can delete own submission files" ON storage.objects;
CREATE POLICY "Users can delete own submission files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'event-submissions' AND
    auth.role() = 'authenticated'
);
