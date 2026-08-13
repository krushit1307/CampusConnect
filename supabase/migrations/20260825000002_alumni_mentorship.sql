-- =============================================================================
-- Migration: Alumni Mentorship Matching Module
-- Issue: #2963 - Build an 'Alumni Mentorship' Matching Module
-- Description: Creates tables for mentor profiles, capacity limits, and 
-- mentorship requests. Includes triggers to automatically hide profiles 
-- when they reach their max_mentees capacity.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Mentor Profiles (Alumni opt-in)
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    industry TEXT NOT NULL,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    bio TEXT,
    expertise_tags TEXT[] NOT NULL DEFAULT '{}',
    club_affiliations UUID[] DEFAULT '{}', -- Array of club IDs they were part of
    max_mentees INT NOT NULL DEFAULT 3 CHECK (max_mentees > 0),
    current_mentees INT NOT NULL DEFAULT 0,
    is_accepting BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_profiles_industry ON public.mentor_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_company ON public.mentor_profiles(company);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_accepting ON public.mentor_profiles(is_accepting);

-- 2. Mentorship Requests
CREATE TABLE IF NOT EXISTS public.mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES public.mentor_profiles(user_id) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(message) <= 1000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate active requests between the same pair
    UNIQUE(mentor_id, mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentor ON public.mentorship_requests(mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_mentorship_requests_mentee ON public.mentorship_requests(mentee_id, status);

-- =============================================================================
-- Capacity Management Trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_mentor_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
        UPDATE public.mentor_profiles 
        SET current_mentees = current_mentees + 1,
            is_accepting = CASE WHEN current_mentees + 1 >= max_mentees THEN FALSE ELSE is_accepting END,
            updated_at = NOW()
        WHERE user_id = NEW.mentor_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If status changed FROM accepted TO something else (rejected/completed)
        IF OLD.status = 'accepted' AND NEW.status != 'accepted' THEN
            UPDATE public.mentor_profiles 
            SET current_mentees = GREATEST(0, current_mentees - 1),
                is_accepting = TRUE, -- Re-open if they were full
                updated_at = NOW()
            WHERE user_id = NEW.mentor_id;
        -- If status changed TO accepted
        ELSIF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
            UPDATE public.mentor_profiles 
            SET current_mentees = current_mentees + 1,
                is_accepting = CASE WHEN current_mentees + 1 >= max_mentees THEN FALSE ELSE is_accepting END,
                updated_at = NOW()
            WHERE user_id = NEW.mentor_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_mentor_capacity ON public.mentorship_requests;
CREATE TRIGGER trg_update_mentor_capacity
AFTER INSERT OR UPDATE OF status ON public.mentorship_requests
FOR EACH ROW EXECUTE FUNCTION public.update_mentor_capacity();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view mentor profiles (Directory)
CREATE POLICY "Anyone can view mentor profiles"
ON public.mentor_profiles FOR SELECT
USING (auth.role() = 'authenticated');

-- Alumni can manage their own profile
CREATE POLICY "Alumni can manage own profile"
ON public.mentor_profiles FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Students can view their own requests and mentors can view requests sent to them
CREATE POLICY "Users can view relevant requests"
ON public.mentorship_requests FOR SELECT
USING (auth.uid() = mentee_id OR auth.uid() = mentor_id);

-- Students can insert requests (if mentor is accepting)
CREATE POLICY "Students can send requests"
ON public.mentorship_requests FOR INSERT
WITH CHECK (
    auth.uid() = mentee_id AND
    EXISTS (
        SELECT 1 FROM public.mentor_profiles mp 
        WHERE mp.user_id = mentor_id AND mp.is_accepting = TRUE
    )
);

-- Mentors can update status (accept/reject), Students can only withdraw (delete)
CREATE POLICY "Mentors can update request status"
ON public.mentorship_requests FOR UPDATE
USING (auth.uid() = mentor_id);

CREATE POLICY "Students can withdraw pending requests"
ON public.mentorship_requests FOR DELETE
USING (auth.uid() = mentee_id AND status = 'pending');
