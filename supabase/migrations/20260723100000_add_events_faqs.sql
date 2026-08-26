-- Add a JSONB column to store FAQ Q&A pairs for events.
-- Format: [{ "question": "...", "answer": "..." }, ...]

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
