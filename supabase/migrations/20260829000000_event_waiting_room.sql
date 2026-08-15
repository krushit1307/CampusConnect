-- Migration: 20260829000000_event_waiting_room.sql
-- Description: Adds high_demand column to events.

-- Add high_demand column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS high_demand BOOLEAN NOT NULL DEFAULT false;
