-- Migration: 20261022000002_add_club_hibernation_status.sql
-- Description: Add hibernation statuses to club_status ENUM, and add tracking columns to clubs table.

-- 1. Add new enum values (idempotent if they already exist)
ALTER TYPE club_status ADD VALUE IF NOT EXISTS 'hibernating';
ALTER TYPE club_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Add hibernation metadata tracking columns and financial hold flag
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hibernation_warning_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hibernated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS financial_hold BOOLEAN DEFAULT FALSE;

-- 3. Update the existing index (or create a new one if needed, though status index might already exist)
CREATE INDEX IF NOT EXISTS idx_clubs_status ON public.clubs(status);
