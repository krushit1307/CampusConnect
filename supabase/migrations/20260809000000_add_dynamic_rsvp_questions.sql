-- 1. Add custom_questions JSONB to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Add custom_answers JSONB to rsvps
ALTER TABLE rsvps 
ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb NOT NULL;