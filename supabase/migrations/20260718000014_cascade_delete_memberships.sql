-- ============================================================
-- Migration: 20260718000014_cascade_delete_memberships.sql
-- Description:
-- Drops the existing foreign key constraints on the club_members
-- table and recreates them with ON DELETE CASCADE to ensure that
-- membership records are cleaned up when a club or user is deleted.
-- ============================================================

-- Drop existing foreign key constraints on the club_members table if they exist
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_club_id_fkey;
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_user_id_fkey;

-- Recreate foreign key constraints linking to profiles and clubs with ON DELETE CASCADE
ALTER TABLE club_members
  ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  ADD CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
