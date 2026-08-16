-- Migration: Mentorship Program Matching Module (#2803)
-- Description: Creates mentorship_profiles and mentorship_pairs tables, compatibility scoring RPC, and capacity management.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mentorship_role_enum') THEN
        CREATE TYPE public.mentorship_role_enum AS ENUM ('mentor', 'mentee');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mentorship_pair_status_enum') THEN
        CREATE TYPE public.mentorship_pair_status_enum AS ENUM ('pending', 'active', 'declined', 'dissolved');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mentorship_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.mentorship_role_enum NOT NULL,
    major TEXT NOT NULL,
    interests TEXT[] NOT NULL DEFAULT '{}',
    career_goals TEXT,
    bio TEXT,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mentorship_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.mentorship_profiles(user_id) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES public.mentorship_profiles(user_id) ON DELETE CASCADE,
    status public.mentorship_pair_status_enum NOT NULL DEFAULT 'pending',
    request_message TEXT,
    dissolution_reason TEXT,
    dissolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (mentor_id, mentee_id)
);

-- Enable RLS
ALTER TABLE public.mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_pairs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone authenticated can view mentorship profiles" ON public.mentorship_profiles;
    CREATE POLICY "Anyone authenticated can view mentorship profiles" ON public.mentorship_profiles FOR SELECT USING (TRUE);

    DROP POLICY IF EXISTS "Users can manage own mentorship profile" ON public.mentorship_profiles;
    CREATE POLICY "Users can manage own mentorship profile" ON public.mentorship_profiles FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Participants can view pairs" ON public.mentorship_pairs;
    CREATE POLICY "Participants can view pairs" ON public.mentorship_pairs FOR SELECT USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);

    DROP POLICY IF EXISTS "Mentees can create requests" ON public.mentorship_pairs;
    CREATE POLICY "Mentees can create requests" ON public.mentorship_pairs FOR INSERT WITH CHECK (auth.uid() = mentee_id);

    DROP POLICY IF EXISTS "Participants can update pairs" ON public.mentorship_pairs;
    CREATE POLICY "Participants can update pairs" ON public.mentorship_pairs FOR UPDATE USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);
END $$;

-- Compatibility calculation RPC: Exact major = 50 pts, each shared interest = 10 pts
CREATE OR REPLACE FUNCTION public.get_recommended_mentors(p_mentee_id UUID)
RETURNS TABLE (
    mentor_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    major TEXT,
    interests TEXT[],
    bio TEXT,
    capacity INT,
    active_mentees INT,
    compatibility_score INT,
    shared_interests_count INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    v_mentee_major TEXT;
    v_mentee_interests TEXT[];
BEGIN
    SELECT mp.major, mp.interests 
    INTO v_mentee_major, v_mentee_interests
    FROM public.mentorship_profiles mp
    WHERE mp.user_id = p_mentee_id;

    RETURN QUERY
    SELECT 
        m.user_id as mentor_id,
        COALESCE(p.full_name, 'Campus Mentor') as full_name,
        p.avatar_url,
        m.major,
        m.interests,
        m.bio,
        m.capacity,
        COALESCE((
            SELECT COUNT(*)::INT 
            FROM public.mentorship_pairs pair 
            WHERE pair.mentor_id = m.user_id AND pair.status = 'active'
        ), 0) as active_mentees,
        (
            CASE WHEN LOWER(m.major) = LOWER(v_mentee_major) THEN 50 ELSE 0 END +
            COALESCE((
                SELECT (COUNT(*) * 10)::INT 
                FROM unnest(m.interests) mi 
                WHERE mi = ANY(v_mentee_interests)
            ), 0)
        ) as compatibility_score,
        COALESCE((
            SELECT COUNT(*)::INT 
            FROM unnest(m.interests) mi 
            WHERE mi = ANY(v_mentee_interests)
        ), 0) as shared_interests_count
    FROM public.mentorship_profiles m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.role = 'mentor' 
      AND m.is_active = TRUE
      AND m.user_id != p_mentee_id
    ORDER BY compatibility_score DESC, active_mentees ASC;
END;
$$;
