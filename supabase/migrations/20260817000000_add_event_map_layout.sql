-- Migration: Add map_layout column to events table for interactive map builder
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS map_layout JSONB DEFAULT '[]'::jsonb NOT NULL;
