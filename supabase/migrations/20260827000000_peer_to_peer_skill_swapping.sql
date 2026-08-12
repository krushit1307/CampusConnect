-- Migration: 20260827000000_peer_to_peer_skill_swapping.sql
-- Description: Sets up skills taxonomy and user offered/needed skills tables, RLS policies, and matching RPC.

-- 1. Create skills_taxonomy table
CREATE TABLE IF NOT EXISTS public.skills_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.skills_taxonomy ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read taxonomy
CREATE POLICY "Anyone can view skills taxonomy" ON public.skills_taxonomy
    FOR SELECT TO authenticated USING (true);

-- Only system admins can insert/modify taxonomy
CREATE POLICY "Admins can manage skills taxonomy" ON public.skills_taxonomy
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'system_admin'::user_role
        )
    );

-- 2. Create user_offered_skills junction table
CREATE TABLE IF NOT EXISTS public.user_offered_skills (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills_taxonomy(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.user_offered_skills ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view offered skills
CREATE POLICY "Anyone can view offered skills" ON public.user_offered_skills
    FOR SELECT TO authenticated USING (true);

-- Users can manage their own offered skills
CREATE POLICY "Users can manage their own offered skills" ON public.user_offered_skills
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Create user_needed_skills junction table
CREATE TABLE IF NOT EXISTS public.user_needed_skills (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills_taxonomy(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.user_needed_skills ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view needed skills
CREATE POLICY "Anyone can view needed skills" ON public.user_needed_skills
    FOR SELECT TO authenticated USING (true);

-- Users can manage their own needed skills
CREATE POLICY "Users can manage their own needed skills" ON public.user_needed_skills
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Seed initial skills into taxonomy
INSERT INTO public.skills_taxonomy (name) VALUES
    ('React'), ('Next.js'), ('Vue.js'), ('Angular'), ('JavaScript'), 
    ('TypeScript'), ('Node.js'), ('Python'), ('Go'), ('Rust'), 
    ('Ruby on Rails'), ('PostgreSQL'), ('MongoDB'), ('GraphQL'), 
    ('Tailwind CSS'), ('Graphic Design'), ('UI/UX Design'), ('Figma'), 
    ('Logo Design'), ('Photography'), ('Video Editing'), ('Spanish Translation'), 
    ('French Translation'), ('Public Speaking'), ('Creative Writing'), 
    ('Technical Writing'), ('Math Tutoring'), ('Physics Tutoring'), 
    ('Chemistry Tutoring'), ('Music Production'), ('Guitar Lessons'), 
    ('Piano Lessons'), ('Marketing'), ('SEO'), ('Product Management')
ON CONFLICT (name) DO NOTHING;

-- 5. Create skill swapping matches RPC function
CREATE OR REPLACE FUNCTION public.get_skill_swap_matches(p_user_id UUID)
RETURNS TABLE (
    matched_user_id UUID,
    full_name TEXT,
    handle TEXT,
    avatar_url TEXT,
    skills_they_offer_i_need TEXT[],
    skills_i_offer_they_need TEXT[],
    match_score INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH mutual_matches AS (
    SELECT 
      p.id AS user_id,
      p.full_name,
      p.handle,
      p.avatar_url,
      -- Skills they offer that I need
      ARRAY(
        SELECT st.name 
        FROM public.user_offered_skills uos
        JOIN public.skills_taxonomy st ON uos.skill_id = st.id
        WHERE uos.user_id = p.id
          AND uos.skill_id IN (
            SELECT uns.skill_id 
            FROM public.user_needed_skills uns 
            WHERE uns.user_id = p_user_id
          )
      ) AS offered_match,
      -- Skills I offer that they need
      ARRAY(
        SELECT st.name
        FROM public.user_needed_skills uns
        JOIN public.skills_taxonomy st ON uns.skill_id = st.id
        WHERE uns.user_id = p.id
          AND uns.skill_id IN (
            SELECT uos.skill_id
            FROM public.user_offered_skills uos
            WHERE uos.user_id = p_user_id
          )
      ) AS needed_match
    FROM public.profiles p
    WHERE p.id != p_user_id
  )
  SELECT 
    m.user_id,
    COALESCE(m.full_name, 'Student')::TEXT AS full_name,
    m.handle::TEXT,
    m.avatar_url::TEXT,
    m.offered_match::TEXT[],
    m.needed_match::TEXT[],
    (cardinality(m.offered_match) + cardinality(m.needed_match))::INT AS match_score
  FROM mutual_matches m
  WHERE cardinality(m.offered_match) > 0 OR cardinality(m.needed_match) > 0
  ORDER BY match_score DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_skill_swap_matches(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_skill_swap_matches(UUID) TO service_role;
