-- 1. Create alumni_profiles table to store pre-filled past experience and directory listings
CREATE TABLE IF NOT EXISTS alumni_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    role_title TEXT NOT NULL,
    past_experience_summary TEXT NOT NULL,
    is_mentor_available BOOLEAN DEFAULT TRUE NOT NULL,
    is_speaker_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, club_id)
);

-- Index for directory lookups
CREATE INDEX IF NOT EXISTS idx_alumni_profiles_club ON alumni_profiles(club_id, user_id);

-- Enable RLS
ALTER TABLE alumni_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for alumni directory profiles
CREATE POLICY "Public read access for alumni directory profiles"
    ON alumni_profiles FOR SELECT
    USING (TRUE);

-- 2. Stored RPC procedure to transition graduating executives into Alumni Mentors
CREATE OR REPLACE FUNCTION convert_graduating_leader_to_alumni(
    p_user_id UUID,
    p_club_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    club_name TEXT,
    former_role TEXT,
    profile_id UUID
) AS $$
DECLARE
    v_role TEXT;
    v_club_name TEXT;
    v_summary TEXT;
    v_profile_id UUID;
BEGIN
    -- Check if user is an executive in the club
    SELECT cm.role, c.name INTO v_role, v_club_name
    FROM club_memberships cm
    JOIN clubs c ON c.id = cm.club_id
    WHERE cm.user_id = p_user_id AND cm.club_id = p_club_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, p_user_id, NULL::TEXT, NULL::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Update membership role to Alumni_Mentor
    UPDATE club_memberships
    SET role = 'Alumni_Mentor',
        updated_at = NOW()
    WHERE user_id = p_user_id AND club_id = p_club_id;

    v_summary := 'Verified former ' || v_role || ' at ' || v_club_name || '.';

    -- Pre-fill Alumni Directory profile
    INSERT INTO alumni_profiles (user_id, club_id, role_title, past_experience_summary)
    VALUES (p_user_id, p_club_id, 'Alumni Mentor (Former ' || v_role || ')', v_summary)
    ON CONFLICT (user_id, club_id) DO UPDATE
    SET role_title = EXCLUDED.role_title,
        past_experience_summary = EXCLUDED.past_experience_summary
    RETURNING id INTO v_profile_id;

    RETURN QUERY SELECT TRUE, p_user_id, v_club_name, v_role, v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;