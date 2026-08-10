-- Add version column to clubs for optimistic concurrency control
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
