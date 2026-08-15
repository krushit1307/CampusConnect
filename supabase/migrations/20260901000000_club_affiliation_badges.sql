-- Migration: 20260901000000_club_affiliation_badges.sql
-- Description: Issue #3005 - Club Affiliation Badges System for Forum & Chat

-- 1. Add display_badges privacy column to posts and comments
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS display_badges BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS display_badges BOOLEAN DEFAULT TRUE NOT NULL;

-- 2. Create RPC function to fetch active executive club affiliations for a user
CREATE OR REPLACE FUNCTION public.get_user_club_affiliations(p_user_id UUID)
RETURNS TABLE (
    club_id UUID,
    club_name TEXT,
    club_slug TEXT,
    club_logo_url TEXT,
    role_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        c.id AS club_id,
        c.name AS club_name,
        c.slug AS club_slug,
        c.logo_url AS club_logo_url,
        COALESCE(cr.name, 'Executive') AS role_name
    FROM public.club_members cm
    JOIN public.clubs c ON cm.club_id = c.id
    JOIN public.club_roles cr ON cm.role_id = cr.id
    WHERE cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND LOWER(cr.name) NOT IN ('member', 'general member', 'subscriber', 'applicant')
    ORDER BY c.name ASC;
$$;
