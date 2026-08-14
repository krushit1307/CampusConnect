-- Migration: Add blurhash column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS blurhash text;

COMMENT ON COLUMN events.blurhash IS 'Compact 30-character Blurhash string representation for image placeholder rendering';
