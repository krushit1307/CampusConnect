-- Migration: Add pluggable widget configuration to the clubs table
--
-- Issue #2737: clubs want their public profile to be a useful landing
-- page (weather, countdown, Spotify embed, ...). Club admins configure a
-- list of widgets through the manage panel; the public Club Profile page
-- maps over this array and renders each enabled widget.
--
-- Example value:
--   [{"id":"widget-abc","type":"weather","enabled":true,"location":"London"},
--    {"id":"widget-def","type":"countdown","enabled":true,"target":"2026-10-10"}]
--
-- The CHECK constraint mirrors the existing social_links_order column:
-- only a JSON array is ever stored.

ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS widgets_config JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_clubs_widgets_config_is_array'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_widgets_config_is_array
        CHECK (jsonb_typeof(widgets_config) = 'array');
    END IF;
END $$;

-- Rollback:
--   ALTER TABLE public.clubs DROP CONSTRAINT check_clubs_widgets_config_is_array;
--   ALTER TABLE public.clubs DROP COLUMN widgets_config;
