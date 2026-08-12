-- =============================================================================
-- Migration: Forum Real-Time Polls
-- Issue: #2819 - Implement Real-Time Polling Widget Embeddable in Markdown
-- Description: Creates tables to store poll definitions and user votes.
-- Includes strict unique constraints to enforce "one vote per user per poll"
-- and enables Supabase Realtime for instant UI updates.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Forum Polls Table
CREATE TABLE IF NOT EXISTS public.forum_polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings: ["Pizza", "Sushi", "Tacos"]
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_polls_post_id 
ON public.forum_polls(post_id);

-- 2. Poll Votes Table
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES public.forum_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    option_index INT NOT NULL, -- The index of the option in the JSONB array
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- CRITICAL: Enforce strictly one vote per user per poll
    UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id 
ON public.poll_votes(poll_id);

-- Enable Supabase Realtime for the poll_votes table
-- This allows the frontend to subscribe to INSERT/DELETE events and animate progress bars
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.forum_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Anyone who can view the post can view the poll and its votes
CREATE POLICY "Anyone can view polls"
ON public.forum_polls FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.clubs c ON p.club_id = c.id
        JOIN public.club_members cm ON c.id = cm.club_id
        WHERE p.id = forum_polls.post_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Anyone can view poll votes"
ON public.poll_votes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.forum_polls fp
        JOIN public.posts p ON fp.post_id = p.id
        JOIN public.clubs c ON p.club_id = c.id
        JOIN public.club_members cm ON c.id = cm.club_id
        WHERE fp.id = poll_votes.poll_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

-- Authenticated club members can insert (vote) and delete (change vote)
CREATE POLICY "Members can vote on polls"
ON public.poll_votes FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.forum_polls fp
        JOIN public.posts p ON fp.post_id = p.id
        JOIN public.clubs c ON p.club_id = c.id
        JOIN public.club_members cm ON c.id = cm.club_id
        WHERE fp.id = poll_votes.poll_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

CREATE POLICY "Members can change their vote"
ON public.poll_votes FOR DELETE
USING (auth.uid() = user_id);
