-- ============================================================
-- Migration: 002_event_categories.sql
-- Description:
-- Adds event category support by introducing an
-- event_categories table and linking events to categories.
-- ============================================================

-- ------------------------------------------------------------
-- Create event_categories table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to event categories
DROP POLICY IF EXISTS "Event categories are viewable by everyone." ON event_categories;
CREATE POLICY "Event categories are viewable by everyone." 
ON event_categories FOR SELECT 
USING (true);

-- ------------------------------------------------------------
-- Add category reference to events
-- ------------------------------------------------------------

ALTER TABLE events
ADD COLUMN IF NOT EXISTS category_id UUID;

-- Add the foreign key only if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_events_category'
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT fk_events_category
        FOREIGN KEY (category_id)
        REFERENCES event_categories(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------
-- Performance index
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_category
ON events(category_id);

-- ------------------------------------------------------------
-- Seed default categories
-- ------------------------------------------------------------

-- Default categories available after migration.
INSERT INTO event_categories (name, description)
VALUES
    ('Tech', 'Hackathons, coding contests and technical workshops'),
    ('Cultural', 'Music, dance, drama and cultural activities'),
    ('Sports', 'Sports competitions and fitness events'),
    ('Workshop', 'Hands-on learning sessions'),
    ('Seminar', 'Expert talks and knowledge sharing sessions'),
    ('Career', 'Placement drives and career guidance'),
    ('Community', 'Social and community engagement events')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------