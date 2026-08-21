-- Migration: 20261231000012_live_coding_sandboxes.sql
-- Interactive Live Coding Sandbox for Hackathons & Workshops (#3591)

-- 1. Create table for event live coding sandboxes (Speaker master sandbox + session state)
CREATE TABLE IF NOT EXISTS public.event_code_sandboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    speaker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'javascript', -- 'javascript', 'python', 'typescript', 'html'
    master_code TEXT NOT NULL DEFAULT '',
    execution_timeout_ms INT NOT NULL DEFAULT 5000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_code_sandboxes_event ON public.event_code_sandboxes(event_id);

-- 2. Create table for attendee sandbox executions & fork states
CREATE TABLE IF NOT EXISTS public.attendee_code_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id UUID NOT NULL REFERENCES public.event_code_sandboxes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'running')) DEFAULT 'success',
    output TEXT,
    execution_time_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_attendee_code_executions_user ON public.attendee_code_executions(sandbox_id, user_id);

-- Enable RLS
ALTER TABLE public.event_code_sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_code_executions ENABLE ROW LEVEL SECURITY;

-- Policies for event_code_sandboxes
CREATE POLICY "Anyone registered or viewing event can view master sandbox"
    ON public.event_code_sandboxes
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Speaker/Host can update master sandbox"
    ON public.event_code_sandboxes
    FOR ALL
    TO authenticated
    USING (auth.uid() = speaker_id)
    WITH CHECK (auth.uid() = speaker_id);

-- Policies for attendee_code_executions
CREATE POLICY "Users can view their own code executions"
    ON public.attendee_code_executions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own code executions"
    ON public.attendee_code_executions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Realtime publication for master sandbox live sync
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_code_sandboxes;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
