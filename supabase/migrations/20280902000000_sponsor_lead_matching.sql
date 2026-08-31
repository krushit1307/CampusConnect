-- Migration: 20280902000000_sponsor_lead_matching.sql
-- Description: Create Job Descriptions, parsed resumes, and Jaccard similarity skill matching

-- 1. Create sponsor_job_descriptions table
CREATE TABLE IF NOT EXISTS public.sponsor_job_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required_skills TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.sponsor_job_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for JDs"
    ON public.sponsor_job_descriptions FOR SELECT
    USING (true);

CREATE POLICY "Allow insert for sponsor users"
    ON public.sponsor_job_descriptions FOR INSERT
    WITH CHECK (true);

-- 2. Create parsed_resumes table
CREATE TABLE IF NOT EXISTS public.parsed_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL,
    raw_parsed_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.parsed_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for parsed resumes"
    ON public.parsed_resumes FOR SELECT
    USING (true);

CREATE POLICY "Allow insert for users on their own resumes"
    ON public.parsed_resumes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Jaccard similarity calculation function
CREATE OR REPLACE FUNCTION public.jaccard_similarity(arr1 TEXT[], arr2 TEXT[])
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_intersection_count INT;
    v_union_count INT;
BEGIN
    IF arr1 IS NULL OR arr2 IS NULL OR array_length(arr1, 1) IS NULL OR array_length(arr2, 1) IS NULL THEN
        RETURN 0.0;
    END IF;

    -- Count intersection
    SELECT COUNT(*) INTO v_intersection_count
    FROM (
        SELECT UNNEST(arr1)
        INTERSECT
        SELECT UNNEST(arr2)
    ) t;

    -- Count union
    SELECT COUNT(*) INTO v_union_count
    FROM (
        SELECT UNNEST(arr1)
        UNION
        SELECT UNNEST(arr2)
    ) t;

    IF v_union_count = 0 THEN
        RETURN 0.0;
    END IF;

    RETURN v_intersection_count::DOUBLE PRECISION / v_union_count::DOUBLE PRECISION;
END;
$$;
