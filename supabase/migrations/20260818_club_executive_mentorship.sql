-- Migration: Club Executive Mentorship Matching
-- Issue #3334

-- 1. Table for Alumni Opt-In Profiles
CREATE TABLE IF NOT EXISTS public.alumni_mentorship_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grad_year INT NOT NULL,
    past_club_roles JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"club_id": "...", "club_name": "Finance Club", "role": "President", "year": 2022}]
    club_categories TEXT[] NOT NULL DEFAULT '{}',
    is_opted_in BOOLEAN NOT NULL DEFAULT true,
    max_mentees INT NOT NULL DEFAULT 3,
    current_mentees_count INT NOT NULL DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_alumni_user UNIQUE (user_id)
);

-- 2. Table for Executive Mentorship Matches
CREATE TABLE IF NOT EXISTS public.mentorship_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mentee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    role_title VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
    channel_id TEXT,
    intro_message TEXT,
    matched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_mentor_mentee_club UNIQUE (mentor_user_id, mentee_user_id, club_id)
);

-- Enable RLS
ALTER TABLE public.alumni_mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_matches ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read active profiles, users manage own
CREATE POLICY "Public read opted in alumni mentors"
    ON public.alumni_mentorship_profiles
    FOR SELECT
    TO authenticated
    USING (is_opted_in = true OR user_id = auth.uid());

CREATE POLICY "Users can manage own mentorship profile"
    ON public.alumni_mentorship_profiles
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Matches: Involved mentors and mentees can view and update match status
CREATE POLICY "Users can view their mentorship matches"
    ON public.mentorship_matches
    FOR SELECT
    TO authenticated
    USING (mentor_user_id = auth.uid() OR mentee_user_id = auth.uid());

CREATE POLICY "Users can update their mentorship match status"
    ON public.mentorship_matches
    FOR UPDATE
    TO authenticated
    USING (mentor_user_id = auth.uid() OR mentee_user_id = auth.uid());

-- Indexing
CREATE INDEX IF NOT EXISTS idx_alumni_opted_in ON public.alumni_mentorship_profiles (is_opted_in) WHERE is_opted_in = true;
CREATE INDEX IF NOT EXISTS idx_mentorship_matches_mentee ON public.mentorship_matches (mentee_user_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_matches_mentor ON public.mentorship_matches (mentor_user_id);
