-- Migration: 20260728160000_add_bug_reports_metadata.sql
-- Description: Add url and user_agent columns to bug_reports table

ALTER TABLE public.bug_reports 
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;
