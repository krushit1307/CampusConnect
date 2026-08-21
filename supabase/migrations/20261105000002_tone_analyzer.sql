-- =============================================================================
-- Migration: Automated Event Description "Tone" Analyzer
-- Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
-- Description: Ensures the clubs table has the 'is_official_university_dept'
-- flag to identify high-tier accounts that require professional tone linting.
-- =============================================================================

-- 1. Add official department flag to clubs table
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS is_official_university_dept BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.clubs.is_official_university_dept IS 'If true, event descriptions are linted for professional tone and brand alignment.';

-- 2. Create index for fast filtering of official departments
CREATE INDEX IF NOT EXISTS idx_clubs_official_dept 
ON public.clubs(is_official_university_dept) 
WHERE is_official_university_dept = TRUE;
