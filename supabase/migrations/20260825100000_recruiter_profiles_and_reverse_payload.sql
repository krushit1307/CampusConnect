-- =============================================================================
-- Migration: Recruiter Profiles & Reverse VCard Payload
-- Issue: #4541 - Build an 'Interactive "Sponsor Lead" Digital Business Card Exchange'
--
-- Creates:
-- 1. recruiter_profiles table for sponsors to set up their digital business card
-- 2. RPC to upsert recruiter profile
-- 3. RPC to trigger reverse payload after sponsor scans student QR code
-- 4. RPC to generate VCF download URL for student
-- =============================================================================

-- 1. Recruiter Profiles Table
CREATE TABLE IF NOT EXISTS public.recruiter_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT,
    linkedin_url TEXT,
    calendly_url TEXT,
    phone TEXT,
    website_url TEXT,
    bio TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_user_id ON public.recruiter_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_company ON public.recruiter_profiles(company_name);

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

-- Recruiters can manage their own profile
CREATE POLICY "Recruiters can view own profile"
    ON public.recruiter_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can insert own profile"
    ON public.recruiter_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Recruiters can update own profile"
    ON public.recruiter_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Students can view active recruiter profiles (for reverse payload display)
CREATE POLICY "Students can view active recruiter profiles"
    ON public.recruiter_profiles FOR SELECT
    USING (is_active = TRUE);

-- 2. Sponsor Lead Connections (tracks reverse payload delivery)
CREATE TABLE IF NOT EXISTS public.sponsor_lead_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sponsor_user_id UUID NOT NULL REFERENCES auth.users(id),
    student_user_id UUID NOT NULL REFERENCES auth.users(id),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recruiter_profile_id UUID NOT NULL REFERENCES public.recruiter_profiles(id),
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    vcf_downloaded BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sponsor_user_id, student_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_lead_connections_student ON public.sponsor_lead_connections(student_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_lead_connections_sponsor ON public.sponsor_lead_connections(sponsor_user_id, event_id);

ALTER TABLE public.sponsor_lead_connections ENABLE ROW LEVEL SECURITY;

-- Sponsors can see their own connections
CREATE POLICY "Sponsors can view own connections"
    ON public.sponsor_lead_connections FOR SELECT
    USING (auth.uid() = sponsor_user_id);

-- Students can see connections where they are the student
CREATE POLICY "Students can view own lead connections"
    ON public.sponsor_lead_connections FOR SELECT
    USING (auth.uid() = student_user_id);

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert connections"
    ON public.sponsor_lead_connections FOR INSERT
    WITH CHECK (TRUE);

-- Service role can update connections
CREATE POLICY "Service role can update connections"
    ON public.sponsor_lead_connections FOR UPDATE
    USING (TRUE);

-- 3. RPC: Upsert Recruiter Profile
CREATE OR REPLACE FUNCTION public.upsert_recruiter_profile(
    p_full_name TEXT,
    p_email TEXT,
    p_company_name TEXT,
    p_job_title TEXT DEFAULT NULL,
    p_linkedin_url TEXT DEFAULT NULL,
    p_calendly_url TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Authentication required.');
    END IF;

    INSERT INTO public.recruiter_profiles (
        user_id, full_name, email, company_name, job_title,
        linkedin_url, calendly_url, phone, website_url, bio
    ) VALUES (
        v_user_id, p_full_name, p_email, p_company_name, p_job_title,
        p_linkedin_url, p_calendly_url, p_phone, p_website_url, p_bio
    )
    ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        company_name = EXCLUDED.company_name,
        job_title = EXCLUDED.job_title,
        linkedin_url = EXCLUDED.linkedin_url,
        calendly_url = EXCLUDED.calendly_url,
        phone = EXCLUDED.phone,
        website_url = EXCLUDED.website_url,
        bio = EXCLUDED.bio,
        updated_at = NOW()
    RETURNING to_jsonb(recruiter_profiles.*) INTO v_result;

    RETURN jsonb_build_object('success', TRUE, 'profile', v_result);
END;
$$;

-- 4. RPC: Get Recruiter Profile by User ID
CREATE OR REPLACE FUNCTION public.get_recruiter_profile(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_profile JSONB;
BEGIN
    SELECT to_jsonb(rp.*) INTO v_profile
    FROM public.recruiter_profiles rp
    WHERE rp.user_id = v_user_id AND rp.is_active = TRUE;

    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'No active recruiter profile found.');
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'profile', v_profile);
END;
$$;

-- 5. RPC: Trigger Reverse Payload (after sponsor scans student)
CREATE OR REPLACE FUNCTION public.trigger_sponsor_reverse_payload(
    p_student_user_id UUID,
    p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_sponsor_user_id UUID := auth.uid();
    v_recruiter_profile RECORD;
    v_connection_id UUID;
BEGIN
    IF v_sponsor_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Authentication required.');
    END IF;

    -- Get sponsor's recruiter profile
    SELECT * INTO v_recruiter_profile
    FROM public.recruiter_profiles
    WHERE user_id = v_sponsor_user_id AND is_active = TRUE;

    IF v_recruiter_profile IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'No active recruiter profile. Please set up your Recruiter Profile first.'
        );
    END IF;

    -- Create connection record
    INSERT INTO public.sponsor_lead_connections (
        sponsor_user_id, student_user_id, event_id, recruiter_profile_id
    ) VALUES (
        v_sponsor_user_id, p_student_user_id, p_event_id, v_recruiter_profile.id
    )
    ON CONFLICT (sponsor_user_id, student_user_id, event_id) DO NOTHING
    RETURNING id INTO v_connection_id;

    IF v_connection_id IS NULL THEN
        -- Already connected, get existing
        SELECT id INTO v_connection_id
        FROM public.sponsor_lead_connections
        WHERE sponsor_user_id = v_sponsor_user_id
          AND student_user_id = p_student_user_id
          AND event_id = p_event_id;
    END IF;

    -- Send in-app notification to student
    INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
    VALUES (
        p_student_user_id,
        'reply',
        'New Connection!',
        'You just connected with ' || v_recruiter_profile.full_name || ' from ' || v_recruiter_profile.company_name || '! View their digital business card and book an interview.',
        '/connections/' || v_connection_id::text,
        FALSE
    );

    -- Update notification sent
    UPDATE public.sponsor_lead_connections
    SET notification_sent = TRUE
    WHERE id = v_connection_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Reverse payload delivered to student.',
        'connection_id', v_connection_id,
        'recruiter', jsonb_build_object(
            'full_name', v_recruiter_profile.full_name,
            'company_name', v_recruiter_profile.company_name,
            'job_title', v_recruiter_profile.job_title,
            'linkedin_url', v_recruiter_profile.linkedin_url,
            'calendly_url', v_recruiter_profile.calendly_url,
            'email', v_recruiter_profile.email
        )
    );
END;
$$;

-- 6. RPC: Mark VCF Downloaded
CREATE OR REPLACE FUNCTION public.mark_vcf_downloaded(p_connection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.sponsor_lead_connections
    SET vcf_downloaded = TRUE
    WHERE id = p_connection_id AND student_user_id = auth.uid();

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 7. Updated_at trigger for recruiter_profiles
CREATE OR REPLACE FUNCTION public.handle_recruiter_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_recruiter_profiles_updated_at
    BEFORE UPDATE ON public.recruiter_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_recruiter_profile_updated_at();

-- Grants
GRANT EXECUTE ON FUNCTION public.upsert_recruiter_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recruiter_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_sponsor_reverse_payload TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_vcf_downloaded TO authenticated;

-- Comments
COMMENT ON TABLE public.recruiter_profiles IS 'Issue #4541: Recruiter digital business card profiles for sponsor-student networking.';
COMMENT ON TABLE public.sponsor_lead_connections IS 'Issue #4541: Tracks sponsor-student connections and reverse payload delivery.';
COMMENT ON FUNCTION public.trigger_sponsor_reverse_payload IS 'Issue #4541: Sends recruiter business card + notification to student after sponsor scans their QR code.';
