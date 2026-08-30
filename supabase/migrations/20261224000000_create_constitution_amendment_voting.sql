-- Migration: 20261224000000_create_constitution_amendment_voting.sql
-- Description: Implement tables, RLS policies, and RPC transaction functions for the Dynamic Club Constitution Amendment Voting engine.

-- 1. Create constitution_amendments table
CREATE TABLE IF NOT EXISTS public.constitution_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    original_text TEXT NOT NULL,
    proposed_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'FAILED')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL
);

-- 2. Create amendment_votes table to log individual votes
CREATE TABLE IF NOT EXISTS public.amendment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID NOT NULL REFERENCES public.constitution_amendments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vote BOOLEAN NOT NULL, -- TRUE = YES, FALSE = NO
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (amendment_id, user_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_constitution_amendments_club_id ON public.constitution_amendments(club_id);
CREATE INDEX IF NOT EXISTS idx_amendment_votes_amendment_id ON public.amendment_votes(amendment_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.constitution_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendment_votes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for constitution_amendments
CREATE POLICY "Club members can view amendments" ON public.constitution_amendments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = constitution_amendments.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.status = 'approved'
        )
    );

CREATE POLICY "Club organizers can propose amendments" ON public.constitution_amendments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = constitution_amendments.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.role = 'admin'
        )
    );

CREATE POLICY "Club organizers can update amendments" ON public.constitution_amendments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = constitution_amendments.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.role = 'admin'
        )
    );

-- 6. RLS Policies for amendment_votes
CREATE POLICY "Club members can view amendment votes tally" ON public.amendment_votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.constitution_amendments ca ON ca.club_id = cm.club_id
            WHERE ca.id = amendment_votes.amendment_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'approved'
        )
    );

CREATE POLICY "Club members can cast votes" ON public.amendment_votes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.constitution_amendments ca ON ca.club_id = cm.club_id
            WHERE ca.id = amendment_votes.amendment_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'approved'
        )
    );

CREATE POLICY "Club members can update their votes" ON public.amendment_votes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            JOIN public.constitution_amendments ca ON ca.club_id = cm.club_id
            WHERE ca.id = amendment_votes.amendment_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'approved'
        )
    );

-- 7. Define SQL RPCs

-- A. cast_amendment_vote: Casts or updates a member's vote
CREATE OR REPLACE FUNCTION public.cast_amendment_vote(
    p_amendment_id UUID,
    p_vote BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_club_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_status TEXT;
    v_user_role TEXT;
    v_yes_count INTEGER;
    v_no_count INTEGER;
BEGIN
    -- Resolve amendment details
    SELECT club_id, expires_at, status
    INTO v_club_id, v_expires_at, v_status
    FROM public.constitution_amendments
    WHERE id = p_amendment_id;

    IF v_club_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amendment not found.');
    END IF;

    -- Verify active voting window
    IF v_status != 'PENDING' OR v_expires_at <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Voting window has closed.');
    END IF;

    -- Verify voter is approved member
    SELECT role INTO v_user_role
    FROM public.club_members
    WHERE club_id = v_club_id AND user_id = auth.uid() AND status = 'approved';

    IF v_user_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Only approved club members can vote.');
    END IF;

    -- Cast or update vote
    INSERT INTO public.amendment_votes (amendment_id, user_id, vote)
    VALUES (p_amendment_id, auth.uid(), p_vote)
    ON CONFLICT (amendment_id, user_id)
    DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW();

    -- Calculate current results
    SELECT COUNT(*) FILTER (WHERE vote = TRUE), COUNT(*) FILTER (WHERE vote = FALSE)
    INTO v_yes_count, v_no_count
    FROM public.amendment_votes
    WHERE amendment_id = p_amendment_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Vote cast successfully!',
        'yes_votes', v_yes_count,
        'no_votes', v_no_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. merge_approved_constitution_amendment: Internal helper to merge proposed text
CREATE OR REPLACE FUNCTION public.merge_approved_constitution_amendment(
    p_amendment_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_club_id UUID;
    v_original_text TEXT;
    v_proposed_text TEXT;
    v_title TEXT;
    v_created_by UUID;
    v_current_raw_text TEXT;
    v_new_raw_text TEXT;
    v_current_version_number INTEGER;
    v_current_file_url TEXT;
BEGIN
    -- Fetch amendment details
    SELECT club_id, original_text, proposed_text, title, created_by
    INTO v_club_id, v_original_text, v_proposed_text, v_title, v_created_by
    FROM public.constitution_amendments
    WHERE id = p_amendment_id;

    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Amendment not found';
    END IF;

    -- Fetch current constitution text
    SELECT raw_text, version_number, file_url INTO v_current_raw_text, v_current_version_number, v_current_file_url
    FROM public.archive_constitutions
    WHERE club_id = v_club_id AND effective_to IS NULL;

    IF v_current_raw_text IS NULL THEN
        SELECT raw_text, version_number, file_url INTO v_current_raw_text, v_current_version_number, v_current_file_url
        FROM public.archive_constitutions
        WHERE club_id = v_club_id
        ORDER BY version_number DESC
        LIMIT 1;
    END IF;

    IF v_current_raw_text IS NULL THEN
        v_current_raw_text := v_original_text;
        v_current_version_number := 0;
        v_current_file_url := '';
    END IF;

    -- Replace original_text with proposed_text in baseline
    v_new_raw_text := REPLACE(v_current_raw_text, v_original_text, v_proposed_text);

    -- Supersede current timeline version
    UPDATE public.archive_constitutions
    SET effective_to = NOW()
    WHERE club_id = v_club_id AND effective_to IS NULL;

    -- Insert merged version into archive_constitutions
    INSERT INTO public.archive_constitutions (
        club_id, version_number, raw_text, file_url,
        published_by, change_summary, effective_from, effective_to
    ) VALUES (
        v_club_id,
        v_current_version_number + 1,
        v_new_raw_text,
        v_current_file_url,
        v_created_by,
        'Amendment Merged: ' || v_title,
        NOW(),
        NULL
    );

    -- Sync to club_documents to keep legacy schemas aligned
    INSERT INTO public.club_documents (
        club_id, file_url, version_number, uploaded_by, created_at
    ) VALUES (
        v_club_id,
        v_current_file_url,
        v_current_version_number + 1,
        v_created_by,
        NOW()
    ) ON CONFLICT DO NOTHING;

    -- Update amendment status
    UPDATE public.constitution_amendments
    SET status = 'PASSED'
    WHERE id = p_amendment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. close_amendment_voting: Tallies votes and automatically merges if >66% approval rate
CREATE OR REPLACE FUNCTION public.close_amendment_voting(
    p_amendment_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_club_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_status TEXT;
    v_yes_count INTEGER;
    v_no_count INTEGER;
    v_total_votes INTEGER;
    v_approval_rate NUMERIC;
BEGIN
    -- Fetch amendment details
    SELECT club_id, expires_at, status
    INTO v_club_id, v_expires_at, v_status
    FROM public.constitution_amendments
    WHERE id = p_amendment_id;

    IF v_club_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amendment not found.');
    END IF;

    IF v_status != 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amendment is already closed.');
    END IF;

    -- Tally votes
    SELECT COUNT(*) FILTER (WHERE vote = TRUE), COUNT(*) FILTER (WHERE vote = FALSE)
    INTO v_yes_count, v_no_count
    FROM public.amendment_votes
    WHERE amendment_id = p_amendment_id;

    v_total_votes := v_yes_count + v_no_count;

    IF v_total_votes > 0 THEN
        v_approval_rate := (v_yes_count::NUMERIC / v_total_votes::NUMERIC) * 100.0;
    ELSE
        v_approval_rate := 0.0;
    END IF;

    -- Enforce 66% approval threshold to pass
    IF v_approval_rate >= 66.0 THEN
        PERFORM public.merge_approved_constitution_amendment(p_amendment_id);
        RETURN jsonb_build_object(
            'success', true,
            'status', 'PASSED',
            'message', 'Amendment passed and automatically merged into the master constitution!',
            'yes_votes', v_yes_count,
            'no_votes', v_no_count,
            'approval_rate', v_approval_rate
        );
    ELSE
        UPDATE public.constitution_amendments
        SET status = 'FAILED'
        WHERE id = p_amendment_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'FAILED',
            'message', 'Amendment failed to reach the required 66% approval threshold.',
            'yes_votes', v_yes_count,
            'no_votes', v_no_count,
            'approval_rate', v_approval_rate
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
