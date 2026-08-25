
-- ============================================
-- 1. TABLES
-- ============================================

-- Alumni mentors profile (extended)
CREATE TABLE IF NOT EXISTS alumni_mentors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Professional Details
    current_company VARCHAR(255),
    current_title VARCHAR(255),
    current_industry VARCHAR(100),
    years_of_experience INTEGER,
    
    -- Academic Details
    graduation_year INTEGER,
    major VARCHAR(255),
    minor VARCHAR(255),
    gpa FLOAT,
    
    -- Mentorship Details
    mentor_bio TEXT,
    expertise_areas TEXT[],
    mentorship_style VARCHAR(50) CHECK (mentorship_style IN ('formal', 'casual', 'flexible')),
    max_mentees INTEGER DEFAULT 3,
    current_mentees INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Availability
    availability_hours JSONB, -- { "monday": ["9-12", "14-17"], ... }
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    preferred_meeting_frequency VARCHAR(50) CHECK (preferred_meeting_frequency IN ('weekly', 'biweekly', 'monthly', 'flexible')),
    
    -- Preferences
    preferred_student_years INTEGER[],
    preferred_majors TEXT[],
    preferred_career_goals TEXT[],
    
    -- Stats
    total_sessions INTEGER DEFAULT 0,
    average_rating FLOAT DEFAULT 0,
    response_rate FLOAT DEFAULT 0,
    average_response_time_hours FLOAT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Mentorship interests (from students)
CREATE TABLE IF NOT EXISTS mentorship_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Academic Interests
    major VARCHAR(255),
    minor VARCHAR(255),
    graduation_year INTEGER,
    career_interests TEXT[],
    desired_industries TEXT[],
    target_companies TEXT[],
    
    -- Skills & Experience
    current_skills TEXT[],
    skills_to_develop TEXT[],
    
    -- Mentorship Preferences
    mentorship_goal TEXT,
    weekly_time_commitment_hours INTEGER,
    preferred_mentor_gender VARCHAR(20),
    preferred_mentorship_style VARCHAR(50),
    needs_guidance_in TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id),
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Club memberships (for matching)
CREATE TABLE IF NOT EXISTS mentorship_club_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    club_id UUID NOT NULL,
    club_name VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

-- Match scores cache (for performance)
CREATE TABLE IF NOT EXISTS mentorship_match_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    mentor_id UUID NOT NULL,
    match_score FLOAT NOT NULL,
    
    -- Breakdown scores
    major_match_score FLOAT,
    industry_match_score FLOAT,
    club_match_score FLOAT,
    career_goal_match_score FLOAT,
    skill_match_score FLOAT,
    availability_match_score FLOAT,
    
    -- Matching details
    matching_factors JSONB,
    match_summary TEXT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(student_id, mentor_id),
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES alumni_mentors(id) ON DELETE CASCADE
);

-- Mentorship matches (accepted)
CREATE TABLE IF NOT EXISTS mentorship_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    mentor_id UUID NOT NULL,
    match_score FLOAT,
    status VARCHAR(50) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled')),
    
    -- Match details
    student_notes TEXT,
    mentor_notes TEXT,
    meeting_frequency VARCHAR(50),
    first_session_date TIMESTAMP,
    
    -- Sessions
    total_sessions_planned INTEGER DEFAULT 0,
    total_sessions_completed INTEGER DEFAULT 0,
    next_session_date TIMESTAMP,
    
    -- Feedback
    student_rating INTEGER CHECK (student_rating >= 1 AND student_rating <= 5),
    mentor_rating INTEGER CHECK (mentor_rating >= 1 AND mentor_rating <= 5),
    student_feedback TEXT,
    mentor_feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES alumni_mentors(id) ON DELETE CASCADE
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_alumni_mentors_industry ON alumni_mentors(current_industry);
CREATE INDEX IF NOT EXISTS idx_alumni_mentors_major ON alumni_mentors(major);
CREATE INDEX IF NOT EXISTS idx_alumni_mentors_expertise ON alumni_mentors USING gin(expertise_areas);
CREATE INDEX IF NOT EXISTS idx_mentorship_interests_user ON mentorship_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_club_history_user ON mentorship_club_history(user_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_match_scores_student ON mentorship_match_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_match_scores_score ON mentorship_match_scores(match_score DESC);

-- ============================================
-- 3. MATCHING ALGORITHM FUNCTIONS
-- ============================================

-- Function to calculate match score between student and mentor
CREATE OR REPLACE FUNCTION calculate_match_score(
    student_id UUID,
    mentor_id UUID
)
RETURNS TABLE (
    total_score FLOAT,
    major_score FLOAT,
    industry_score FLOAT,
    club_score FLOAT,
    career_score FLOAT,
    skill_score FLOAT,
    availability_score FLOAT,
    match_summary TEXT,
    matching_factors JSONB
) AS $$
DECLARE
    student_profile RECORD;
    mentor_profile RECORD;
    student_clubs TEXT[];
    mentor_clubs TEXT[];
    club_intersection TEXT[];
    common_clubs INTEGER;
    weight_major FLOAT := 0.30;
    weight_industry FLOAT := 0.35;
    weight_club FLOAT := 0.20;
    weight_career FLOAT := 0.10;
    weight_skill FLOAT := 0.05;
    
    final_score FLOAT := 0;
    major_match FLOAT := 0;
    industry_match FLOAT := 0;
    club_match FLOAT := 0;
    career_match FLOAT := 0;
    skill_match FLOAT := 0;
    availability_match FLOAT := 0;
    
    summary_parts TEXT[] := '{}';
    factors JSONB := '{}'::JSONB;
BEGIN
    -- Get student profile
    SELECT * INTO student_profile FROM mentorship_interests WHERE user_id = student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student interests not found';
    END IF;
    
    -- Get mentor profile
    SELECT * INTO mentor_profile FROM alumni_mentors WHERE id = mentor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mentor not found';
    END IF;
    
    -- 1. MAJOR MATCH (High weight 30%)
    IF student_profile.major IS NOT NULL AND mentor_profile.major IS NOT NULL THEN
        IF student_profile.major = mentor_profile.major THEN
            major_match := 1.0;
            summary_parts := array_append(summary_parts, 'Same major: ' || student_profile.major);
        ELSIF student_profile.major ILIKE '%' || mentor_profile.major || '%' 
              OR mentor_profile.major ILIKE '%' || student_profile.major || '%' THEN
            major_match := 0.7;
            summary_parts := array_append(summary_parts, 'Related major: ' || student_profile.major || ' ↔ ' || mentor_profile.major);
        ELSE
            major_match := 0.1;
        END IF;
    ELSE
        major_match := 0.5; -- Neutral if no data
    END IF;
    
    -- 2. INDUSTRY MATCH (Very High weight 35%)
    IF student_profile.desired_industries IS NOT NULL AND mentor_profile.current_industry IS NOT NULL THEN
        IF student_profile.desired_industries @> ARRAY[mentor_profile.current_industry] THEN
            industry_match := 1.0;
            summary_parts := array_append(summary_parts, 'Perfect industry match: ' || mentor_profile.current_industry);
        ELSIF array_length(array_intersect(student_profile.desired_industries, ARRAY[mentor_profile.current_industry]), 1) > 0 THEN
            industry_match := 0.8;
            summary_parts := array_append(summary_parts, 'Industry match: ' || mentor_profile.current_industry);
        ELSE
            -- Check related industries
            WITH related AS (
                SELECT unnest(ARRAY['technology', 'software', 'it']) AS related_industry
                WHERE mentor_profile.current_industry IN ('technology', 'software', 'it')
                UNION
                SELECT unnest(ARRAY['finance', 'banking', 'investment']) 
                WHERE mentor_profile.current_industry IN ('finance', 'banking', 'investment')
                UNION
                SELECT unnest(ARRAY['healthcare', 'medicine', 'pharma']) 
                WHERE mentor_profile.current_industry IN ('healthcare', 'medicine', 'pharma')
            )
            SELECT COUNT(*) > 0 INTO industry_match
            FROM related
            WHERE related_industry = ANY(student_profile.desired_industries);
            
            IF industry_match THEN
                industry_match := 0.6;
                summary_parts := array_append(summary_parts, 'Related industry: ' || mentor_profile.current_industry);
            ELSE
                industry_match := 0.1;
            END IF;
        END IF;
    ELSE
        industry_match := 0.5;
    END IF;
    
    -- 3. CLUB MATCH (Medium weight 20%)
    -- Get student's clubs
    SELECT array_agg(club_name) INTO student_clubs 
    FROM mentorship_club_history 
    WHERE user_id = student_id;
    
    -- Get mentor's clubs (from their history)
    SELECT array_agg(club_name) INTO mentor_clubs 
    FROM mentorship_club_history 
    WHERE user_id = mentor_profile.user_id;
    
    IF student_clubs IS NOT NULL AND mentor_clubs IS NOT NULL THEN
        -- Find common clubs
        SELECT array_agg(value) INTO club_intersection
        FROM unnest(student_clubs)
        WHERE unnest = ANY(mentor_clubs);
        
        common_clubs := COALESCE(array_length(club_intersection, 1), 0);
        club_match := LEAST(common_clubs * 0.2, 1.0);
        
        IF common_clubs > 0 THEN
            summary_parts := array_append(summary_parts, 'Shared club(s): ' || array_to_string(club_intersection[1:3], ', '));
        END IF;
    ELSE
        club_match := 0.3;
    END IF;
    
    -- 4. CAREER GOAL MATCH (Low weight 10%)
    IF student_profile.career_interests IS NOT NULL 
       AND mentor_profile.current_title IS NOT NULL 
       AND mentor_profile.current_company IS NOT NULL THEN
        
        -- Check if mentor's company is in student's target companies
        IF student_profile.target_companies IS NOT NULL 
           AND student_profile.target_companies @> ARRAY[mentor_profile.current_company] THEN
            career_match := 1.0;
            summary_parts := array_append(summary_parts, 'Dream company: ' || mentor_profile.current_company);
        ELSIF student_profile.career_interests @> ARRAY[mentor_profile.current_title] THEN
            career_match := 0.8;
            summary_parts := array_append(summary_parts, 'Career match: ' || mentor_profile.current_title);
        ELSE
            career_match := 0.2;
        END IF;
    ELSE
        career_match := 0.5;
    END IF;
    
    -- 5. SKILL MATCH (Low weight 5%)
    IF student_profile.skills_to_develop IS NOT NULL 
       AND mentor_profile.expertise_areas IS NOT NULL THEN
        
        skill_match := (
            SELECT COALESCE(
                (COUNT(*)::FLOAT / GREATEST(array_length(student_profile.skills_to_develop, 1), 1)),
                0
            )
            FROM unnest(student_profile.skills_to_develop) AS skill
            WHERE skill = ANY(mentor_profile.expertise_areas)
        );
        
        IF skill_match > 0 THEN
            summary_parts := array_append(summary_parts, 'Skills match: ' || ROUND(skill_match * 100) || '%');
        END IF;
    ELSE
        skill_match := 0.3;
    END IF;
    
    -- 6. AVAILABILITY MATCH (Bonus)
    IF mentor_profile.current_mentees < mentor_profile.max_mentees THEN
        availability_match := 1.0;
    ELSE
        availability_match := 0.0;
        summary_parts := array_append(summary_parts, 'Mentor at capacity');
    END IF;
    
    -- Calculate weighted score
    final_score := (
        (major_match * weight_major) +
        (industry_match * weight_industry) +
        (club_match * weight_club) +
        (career_match * weight_career) +
        (skill_match * weight_skill)
    ) * availability_match;
    
    -- Build matching factors JSON
    factors := jsonb_build_object(
        'major_match', major_match,
        'industry_match', industry_match,
        'club_match', club_match,
        'career_match', career_match,
        'skill_match', skill_match,
        'availability_match', availability_match,
        'weights', jsonb_build_object(
            'major', weight_major,
            'industry', weight_industry,
            'club', weight_club,
            'career', weight_career,
            'skill', weight_skill
        ),
        'matching_clubs', club_intersection,
        'common_skills', (
            SELECT array_agg(skill)
            FROM unnest(student_profile.skills_to_develop) AS skill
            WHERE skill = ANY(mentor_profile.expertise_areas)
        )
    );
    
    -- Build summary
    IF array_length(summary_parts, 1) > 0 THEN
        match_summary := array_to_string(summary_parts, '; ');
    ELSE
        match_summary := 'General match based on interests';
    END IF;
    
    -- Return results
    total_score := ROUND(final_score * 100, 2);
    major_score := ROUND(major_match * 100, 2);
    industry_score := ROUND(industry_match * 100, 2);
    club_score := ROUND(club_match * 100, 2);
    career_score := ROUND(career_match * 100, 2);
    skill_score := ROUND(skill_match * 100, 2);
    availability_score := ROUND(availability_match * 100, 2);
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Helper function for array intersection
CREATE OR REPLACE FUNCTION array_intersect(a1 TEXT[], a2 TEXT[])
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[] := '{}';
BEGIN
    IF a1 IS NOT NULL AND a2 IS NOT NULL THEN
        SELECT array_agg(value)
        INTO result
        FROM unnest(a1) AS value
        WHERE value = ANY(a2);
    END IF;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get top matches for a student
CREATE OR REPLACE FUNCTION get_top_mentor_matches(
    student_id UUID,
    limit_count INT DEFAULT 3
)
RETURNS TABLE (
    mentor_id UUID,
    mentor_name VARCHAR(255),
    mentor_company VARCHAR(255),
    mentor_title VARCHAR(255),
    mentor_industry VARCHAR(100),
    match_score FLOAT,
    match_summary TEXT,
    matching_factors JSONB,
    major_match FLOAT,
    industry_match FLOAT,
    club_match FLOAT,
    career_match FLOAT,
    skill_match FLOAT,
    availability_match FLOAT
) AS $$
DECLARE
    mentor_record RECORD;
    match_result RECORD;
    score_cache RECORD;
BEGIN
    -- Check if we have cached scores
    SELECT * INTO score_cache 
    FROM mentorship_match_scores 
    WHERE student_id = student_id 
    AND calculated_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';
    
    IF FOUND THEN
        -- Return cached results
        RETURN QUERY
        SELECT 
            m.id,
            m.full_name,
            m.current_company,
            m.current_title,
            m.current_industry,
            s.match_score,
            s.match_summary,
            s.matching_factors,
            s.major_match_score,
            s.industry_match_score,
            s.club_match_score,
            s.career_goal_match_score,
            s.skill_match_score,
            s.availability_match_score
        FROM alumni_mentors m
        JOIN mentorship_match_scores s ON m.id = s.mentor_id
        WHERE s.student_id = student_id
        ORDER BY s.match_score DESC
        LIMIT limit_count;
        RETURN;
    END IF;
    
    -- Calculate fresh scores
    FOR mentor_record IN 
        SELECT * FROM alumni_mentors 
        WHERE is_active = TRUE 
        AND current_mentees < max_mentees
    LOOP
        -- Calculate match score
        SELECT * INTO match_result 
        FROM calculate_match_score(student_id, mentor_record.id);
        
        -- Insert into cache
        INSERT INTO mentorship_match_scores (
            student_id, 
            mentor_id, 
            match_score,
            major_match_score,
            industry_match_score,
            club_match_score,
            career_goal_match_score,
            skill_match_score,
            availability_match_score,
            matching_factors,
            match_summary
        ) VALUES (
            student_id,
            mentor_record.id,
            match_result.total_score,
            match_result.major_score,
            match_result.industry_score,
            match_result.club_score,
            match_result.career_score,
            match_result.skill_score,
            match_result.availability_score,
            match_result.matching_factors,
            match_result.match_summary
        ) ON CONFLICT (student_id, mentor_id) DO UPDATE SET
            match_score = EXCLUDED.match_score,
            matching_factors = EXCLUDED.matching_factors,
            match_summary = EXCLUDED.match_summary,
            calculated_at = CURRENT_TIMESTAMP;
    END LOOP;
    
    -- Return top matches
    RETURN QUERY
    SELECT 
        m.id,
        m.full_name,
        m.current_company,
        m.current_title,
        m.current_industry,
        s.match_score,
        s.match_summary,
        s.matching_factors,
        s.major_match_score,
        s.industry_match_score,
        s.club_match_score,
        s.career_goal_match_score,
        s.skill_match_score,
        s.availability_match_score
    FROM alumni_mentors m
    JOIN mentorship_match_scores s ON m.id = s.mentor_id
    WHERE s.student_id = student_id
    ORDER BY s.match_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all matches (for cron job)
CREATE OR REPLACE FUNCTION refresh_all_match_scores()
RETURNS VOID AS $$
DECLARE
    student_record RECORD;
BEGIN
    FOR student_record IN 
        SELECT DISTINCT user_id FROM mentorship_interests
    LOOP
        PERFORM get_top_mentor_matches(student_record.user_id, 10);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VIEWS
-- ============================================

-- View for match breakdown
CREATE OR REPLACE VIEW mentorship_match_breakdown AS
SELECT 
    ms.student_id,
    ms.mentor_id,
    m.full_name AS mentor_name,
    m.current_company,
    m.current_title,
    ms.match_score,
    ms.major_match_score,
    ms.industry_match_score,
    ms.club_match_score,
    ms.career_goal_match_score AS career_match_score,
    ms.skill_match_score,
    ms.availability_match_score,
    ms.match_summary,
    ms.matching_factors,
    ms.calculated_at
FROM mentorship_match_scores ms
JOIN alumni_mentors m ON ms.mentor_id = m.id
ORDER BY ms.match_score DESC;

-- View for mentor statistics
CREATE OR REPLACE VIEW mentor_stats AS
SELECT 
    am.id,
    am.full_name,
    am.current_company,
    am.current_industry,
    COUNT(DISTINCT ms.student_id) AS total_matches,
    AVG(ms.match_score) AS avg_match_score,
    COUNT(DISTINCT mm.student_id) AS active_mentees,
    am.max_mentees,
    am.total_sessions,
    am.average_rating,
    am.response_rate
FROM alumni_mentors am
LEFT JOIN mentorship_match_scores ms ON am.id = ms.mentor_id
LEFT JOIN mentorship_matches mm ON am.id = mm.mentor_id AND mm.status IN ('pending', 'active')
GROUP BY am.id;

-- ============================================
-- 5. SAMPLE DATA
-- ============================================

-- Insert sample alumni mentors
INSERT INTO alumni_mentors (user_id, full_name, email, current_company, current_title, current_industry, major, graduation_year, expertise_areas, mentorship_style, max_mentees, is_active)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jane Doe', 'jane.doe@google.com', 'Google', 'Senior Software Engineer', 'Technology', 'Computer Science', 2020, ARRAY['Software Engineering', 'Python', 'Machine Learning', 'System Design'], 'formal', 3, TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'John Smith', 'john.smith@microsoft.com', 'Microsoft', 'Cloud Solutions Architect', 'Technology', 'Information Technology', 2019, ARRAY['Cloud Computing', 'Azure', 'DevOps', 'AWS'], 'casual', 5, TRUE),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Sarah Johnson', 'sarah.j@jpmorgan.com', 'JPMorgan Chase', 'Investment Banking Analyst', 'Finance', 'Finance', 2021, ARRAY['Investment Banking', 'Financial Modeling', 'M&A', 'Valuation'], 'formal', 2, TRUE),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Mike Chen', 'mike.chen@apple.com', 'Apple', 'Product Design Manager', 'Design', 'Industrial Design', 2018, ARRAY['Product Design', 'UI/UX', 'Design Thinking', 'Innovation'], 'flexible', 4, TRUE),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Emily Patel', 'emily.patel@healthcare.org', 'Mayo Clinic', 'Medical Researcher', 'Healthcare', 'Biology', 2017, ARRAY['Medical Research', 'Genetics', 'Clinical Trials', 'Bioinformatics'], 'formal', 3, TRUE);

-- Insert student interests
INSERT INTO mentorship_interests (user_id, major, graduation_year, career_interests, desired_industries, target_companies, current_skills, skills_to_develop, mentorship_goal, preferred_mentorship_style)
VALUES 
    ('student-001', 'Computer Science', 2026, ARRAY['Software Engineer', 'Machine Learning Engineer'], ARRAY['Technology', 'AI'], ARRAY['Google', 'Microsoft'], ARRAY['Python', 'JavaScript'], ARRAY['Machine Learning', 'System Design', 'Cloud Computing'], 'Learn best practices from industry professionals', 'formal');

-- Insert club memberships
INSERT INTO mentorship_club_history (user_id, club_id, club_name, role, start_date, is_active)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'club-001', 'Tech Club', 'President', '2019-01-01', TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'club-001', 'Tech Club', 'Member', '2018-01-01', TRUE),
    ('student-001', 'club-001', 'Tech Club', 'Vice President', '2024-01-01', TRUE),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'club-002', 'AI Society', 'Founder', '2020-01-01', TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'club-002', 'AI Society', 'Member', '2019-01-01', TRUE),
    ('student-001', 'club-003', 'Entrepreneurship Club', 'Member', '2023-01-01', TRUE);

-- Calculate matches for sample student
SELECT * FROM get_top_mentor_matches('student-001', 3);

-- ============================================
-- 6. USAGE EXAMPLES
-- ============================================

-- Get top 3 matches for a student
/*
SELECT * FROM get_top_mentor_matches('your-student-id-here', 3);
*/

-- Get match breakdown for all students
/*
SELECT * FROM mentorship_match_breakdown WHERE student_id = 'your-student-id-here';
*/

-- Get mentor statistics
/*
SELECT * FROM mentor_stats;
*/

-- Find mentor capacity
/*
SELECT 
    full_name,
    current_company,
    current_mentees,
    max_mentees,
    (max_mentees - current_mentees) AS available_slots
FROM alumni_mentors
WHERE is_active = TRUE
ORDER BY available_slots DESC;
*/

-- Refresh all matches (run daily via cron)
/*
SELECT refresh_all_match_scores();
*/

-- ============================================
-- 7. CLEANUP
-- ============================================

/*
DROP VIEW IF EXISTS mentor_stats;
DROP VIEW IF EXISTS mentorship_match_breakdown;
DROP TABLE IF EXISTS mentorship_matches;
DROP TABLE IF EXISTS mentorship_match_scores;
DROP TABLE IF EXISTS mentorship_club_history;
DROP TABLE IF EXISTS mentorship_interests;
DROP TABLE IF EXISTS alumni_mentors;
DROP FUNCTION IF EXISTS get_top_mentor_matches(UUID, INT);
DROP FUNCTION IF EXISTS calculate_match_score(UUID, UUID);
DROP FUNCTION IF EXISTS array_intersect(TEXT[], TEXT[]);
DROP FUNCTION IF EXISTS refresh_all_match_scores();
*/
