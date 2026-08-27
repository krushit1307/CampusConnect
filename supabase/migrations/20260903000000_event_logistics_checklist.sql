-- Migration: 20260903000000_event_logistics_checklist.sql
-- Description: Issue #3007 - Event Logistics Checklist & Smart Task Rule Engine

-- 1. Ensure events table has is_published and has_catering columns
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS has_catering BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create event_tasks table
CREATE TABLE IF NOT EXISTS public.event_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date TIMESTAMPTZ,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    task_rule_key TEXT,
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON public.event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_assignee_id ON public.event_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_rule_key ON public.event_tasks(event_id, task_rule_key);

-- 3. Trigger Function: Publication Guard
-- Hard block: Prevents publishing an event when critical tasks are incomplete.
CREATE OR REPLACE FUNCTION public.check_event_publication_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_incomplete_critical_count INT;
BEGIN
    IF NEW.is_published = TRUE THEN
        SELECT COUNT(*) INTO v_incomplete_critical_count
        FROM public.event_tasks
        WHERE event_id = NEW.id
          AND is_critical = TRUE
          AND status != 'done';

        IF v_incomplete_critical_count > 0 THEN
            RAISE EXCEPTION 'Cannot publish event: % critical logistics task(s) (such as Security Approval) must be marked Done first.', v_incomplete_critical_count;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_event_publication_eligibility ON public.events;
CREATE TRIGGER trg_check_event_publication_eligibility
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.check_event_publication_eligibility();

-- 4. Enable Row Level Security on event_tasks
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Viewable by event creators, club admins, and assignees
DROP POLICY IF EXISTS "Users can view relevant event tasks" ON public.event_tasks;
CREATE POLICY "Users can view relevant event tasks"
ON public.event_tasks FOR SELECT
USING (
    assignee_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_tasks.event_id
          AND (
            e.created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = e.club_id
                  AND cm.user_id = auth.uid()
                  AND cm.status = 'approved'
            ) OR
            EXISTS (
                SELECT 1 FROM public.clubs c
                WHERE c.id = e.club_id AND c.created_by = auth.uid()
            )
          )
    )
);

-- INSERT / UPDATE / DELETE policies: Club admins or event creators can manage tasks
DROP POLICY IF EXISTS "Club admins can manage event tasks" ON public.event_tasks;
CREATE POLICY "Club admins can manage event tasks"
ON public.event_tasks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_tasks.event_id
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
