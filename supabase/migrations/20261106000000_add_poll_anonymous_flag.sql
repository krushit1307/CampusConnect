-- Add is_anonymous to polls table
ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;
