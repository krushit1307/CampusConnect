-- Create event_budgets table for snapshot version control
CREATE TABLE IF NOT EXISTS public.event_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    payload_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_final BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching budget history by event
CREATE INDEX idx_event_budgets_event_created ON public.event_budgets(event_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event budgets"
    ON public.event_budgets FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Organizers can create budget snapshots"
    ON public.event_budgets FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Organizers can update budget final status"
    ON public.event_budgets FOR UPDATE
    USING (auth.uid() IS NOT NULL);
