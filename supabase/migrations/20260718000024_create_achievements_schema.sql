-- Create Table IF NOT EXISTS for User Badges and Achievements

-- 1. Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    badge_icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create profile_achievements table
CREATE TABLE IF NOT EXISTS public.profile_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, achievement_id)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for achievements
-- Anyone can view achievements
DROP POLICY IF EXISTS "Achievements are viewable by everyone." ON public.achievements;
CREATE POLICY "Achievements are viewable by everyone." 
ON public.achievements FOR SELECT 
USING (true);

-- Only system admins can modify achievements
DROP POLICY IF EXISTS "System admins can insert achievements." ON public.achievements;
CREATE POLICY "System admins can insert achievements." 
ON public.achievements FOR INSERT 
WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can update achievements." ON public.achievements;
CREATE POLICY "System admins can update achievements." 
ON public.achievements FOR UPDATE 
USING (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can delete achievements." ON public.achievements;
CREATE POLICY "System admins can delete achievements." 
ON public.achievements FOR DELETE 
USING (public.is_system_admin());

-- 5. RLS Policies for profile_achievements
-- Anyone can view profile achievements
DROP POLICY IF EXISTS "Profile achievements are viewable by everyone." ON public.profile_achievements;
CREATE POLICY "Profile achievements are viewable by everyone." 
ON public.profile_achievements FOR SELECT 
USING (true);

-- Only system admins can modify profile achievements directly 
-- (Backend triggers will use service_role to insert these)
DROP POLICY IF EXISTS "System admins can insert profile achievements." ON public.profile_achievements;
CREATE POLICY "System admins can insert profile achievements." 
ON public.profile_achievements FOR INSERT 
WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can update profile achievements." ON public.profile_achievements;
CREATE POLICY "System admins can update profile achievements." 
ON public.profile_achievements FOR UPDATE 
USING (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can delete profile achievements." ON public.profile_achievements;
CREATE POLICY "System admins can delete profile achievements." 
ON public.profile_achievements FOR DELETE 
USING (public.is_system_admin());
