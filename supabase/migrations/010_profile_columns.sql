-- ============================================================
-- Migration: 005_profile_columns.sql
-- Description:
-- Adds handle, linkedin_url, and phone_number columns to profiles.
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS handle TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;
