-- ============================================================
-- Migration: 20260829000001_speaker_briefing.sql
-- Issue: #5059 - Dynamic "Alumni Speaker" Natural Language Speaker Briefing
-- Description:
--   1. Add speaker_briefings table to track generated briefings
--   2. Add speaker_email column to events for alumni speakers
--   3. Create RPC functions for data aggregation and briefing generation
--   4. Create cron job for 72-hour pre-event briefing generation
-- ============================================================

SET lock_timeout = '3s';

-- 1. Add speaker_email column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS speaker_email TEXT,
ADD COLUMN IF NOT EXISTS speaker_name TEXT;

COMMENT ON COLUMN public.events.speaker_email IS 'Email address of the external/alumni speaker for automated briefing delivery';
COMMENT ON COLUMN public.events.speaker_name IS 'Name of the external/alumni speaker';

-- 2. Create speaker_briefings table
CREATE TABLE IF NOT EXISTS public.speaker_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    
    -- Aggregation metadata
    aggregation_start_date TIMESTAMPTZ NOT NULL,
    aggregation_end_date TIMESTAMPTZ NOT NULL,
    chat_messages_count INT DEFAULT 0,
    forum_posts_count INT DEFAULT 0,
    qa_questions_count INT DEFAULT 0,
    
    -- Briefing content
    briefing_content TEXT,
    briefing_summary TEXT,
    top_anxieties JSONB,
    top_topics JSONB,
    top_questions JSONB,
    
    -- PDF storage
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    
    -- Email delivery
    email_sent_at TIMESTAMPTZ,
    email_delivered_at TIMESTAMPTZ,
    email_opened_at TIMESTAMPTZ,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- pending, generating, completed, failed
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'generating', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_speaker_briefings_event_id ON public.speaker_briefings(event_id);
CREATE INDEX IF NOT EXISTS idx_speaker_briefings_club_id ON public.speaker_briefings(club_id);
CREATE INDEX IF NOT EXISTS idx_speaker_briefings_status ON public.speaker_briefings(status);
CREATE INDEX IF NOT EXISTS idx_speaker_briefings_created_at ON public.speaker_briefings(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.speaker_briefings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Club admins can view briefings" ON public.speaker_briefings
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = speaker_briefings.club_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('admin', 'owner')
    )
);

CREATE POLICY "System can insert briefings" ON public.speaker_briefings
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "System can update briefings" ON public.speaker_briefings
FOR UPDATE TO service_role
WITH CHECK (true);

-- 4. Create function to aggregate student discussions
CREATE OR REPLACE FUNCTION public.aggregate_student_discussions(
    p_event_id UUID,
    p_days_back INT DEFAULT 30
)
RETURNS TABLE (
    chat_messages_count INT,
    forum_posts_count INT,
    qa_questions_count INT,
    aggregated_content TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
    v_start_date TIMESTAMPTZ;
    v_chat_count INT;
    v_forum_count INT;
    v_qa_count INT;
    v_aggregated TEXT := '';
BEGIN
    -- Get club_id from event
    SELECT club_id INTO v_club_id
    FROM public.events
    WHERE id = p_event_id;
    
    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;
    
    -- Calculate start date
    v_start_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    -- Count chat messages (club-level chat)
    -- Note: This assumes there's a club_chat_messages table or similar
    -- For now, we'll count direct messages between club members
    SELECT COUNT(*) INTO v_chat_count
    FROM public.chat_messages cm
    JOIN public.club_members cm1 ON cm.sender_id = cm1.user_id AND cm1.club_id = v_club_id
    JOIN public.club_members cm2 ON cm.receiver_id = cm2.user_id AND cm2.club_id = v_club_id
    WHERE cm.created_at >= v_start_date;
    
    -- Count forum posts
    SELECT COUNT(*) INTO v_forum_count
    FROM public.posts
    WHERE club_id = v_club_id
      AND created_at >= v_start_date
      AND deleted_at IS NULL;
    
    -- Count QA questions
    SELECT COUNT(*) INTO v_qa_count
    FROM public.live_questions
    WHERE event_id = p_event_id
      AND created_at >= v_start_date;
    
    -- Aggregate forum posts content
    SELECT string_agg(content, ' ' || E'\n\n' || ' ')
    INTO v_aggregated
    FROM (
        SELECT content
        FROM public.posts
        WHERE club_id = v_club_id
          AND created_at >= v_start_date
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100
    ) sub;
    
    -- Add QA questions
    IF v_aggregated IS NULL THEN
        v_aggregated := '';
    END IF;
    
    v_aggregated := v_aggregated || E'\n\n' || 'Event Q&A Questions:' || E'\n\n';
    
    SELECT v_aggregated || string_agg(content, ' ' || E'\n\n' || ' ')
    INTO v_aggregated
    FROM (
        SELECT content
        FROM public.live_questions
        WHERE event_id = p_event_id
          AND created_at >= v_start_date
        ORDER BY upvotes DESC
        LIMIT 50
    ) sub;
    
    RETURN QUERY
    SELECT v_chat_count, v_forum_count, v_qa_count, v_aggregated;
END;
$$;

-- 5. Create function to create speaker briefing record
CREATE OR REPLACE FUNCTION public.create_speaker_briefing(
    p_event_id UUID,
    p_days_back INT DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_chat_count INT;
    v_forum_count INT;
    v_qa_count INT;
    v_aggregated_content TEXT;
    v_briefing_id UUID;
BEGIN
    -- Get club_id from event
    SELECT club_id INTO v_club_id
    FROM public.events
    WHERE id = p_event_id;
    
    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;
    
    -- Calculate date range
    v_start_date := NOW() - (p_days_back || ' days')::INTERVAL;
    v_end_date := NOW();
    
    -- Aggregate discussions
    SELECT chat_messages_count, forum_posts_count, qa_questions_count, aggregated_content
    INTO v_chat_count, v_forum_count, v_qa_count, v_aggregated_content
    FROM public.aggregate_student_discussions(p_event_id, p_days_back);
    
    -- Create briefing record
    INSERT INTO public.speaker_briefings (
        event_id,
        club_id,
        aggregation_start_date,
        aggregation_end_date,
        chat_messages_count,
        forum_posts_count,
        qa_questions_count,
        briefing_content,
        status
    ) VALUES (
        p_event_id,
        v_club_id,
        v_start_date,
        v_end_date,
        v_chat_count,
        v_forum_count,
        v_qa_count,
        v_aggregated_content,
        'pending'
    ) RETURNING id INTO v_briefing_id;
    
    RETURN v_briefing_id;
END;
$$;

-- 6. Create function to update briefing with LLM-generated content
CREATE OR REPLACE FUNCTION public.update_briefing_content(
    p_briefing_id UUID,
    p_briefing_summary TEXT,
    p_top_anxieties JSONB,
    p_top_topics JSONB,
    p_top_questions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.speaker_briefings
    SET 
        briefing_summary = p_briefing_summary,
        top_anxieties = p_top_anxieties,
        top_topics = p_top_topics,
        top_questions = p_top_questions,
        updated_at = NOW()
    WHERE id = p_briefing_id;
END;
$$;

-- 7. Create function to mark briefing as completed with PDF URL
CREATE OR REPLACE FUNCTION public.complete_briefing(
    p_briefing_id UUID,
    p_pdf_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.speaker_briefings
    SET 
        pdf_url = p_pdf_url,
        pdf_generated_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_briefing_id;
END;
$$;

-- 8. Create function to mark briefing as failed
CREATE OR REPLACE FUNCTION public.fail_briefing(
    p_briefing_id UUID,
    p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.speaker_briefings
    SET 
        status = 'failed',
        error_message = p_error_message,
        updated_at = NOW()
    WHERE id = p_briefing_id;
END;
$$;

-- 9. Create function to get events needing briefings (72 hours before event)
CREATE OR REPLACE FUNCTION public.get_events_needing_briefings()
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    club_id UUID,
    speaker_email TEXT,
    speaker_name TEXT,
    event_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.club_id,
        e.speaker_email,
        e.speaker_name,
        e.start_date
    FROM public.events e
    WHERE e.speaker_email IS NOT NULL
      AND e.speaker_email != ''
      AND e.start_date > NOW()
      AND e.start_date <= NOW() + INTERVAL '72 hours'
      AND NOT EXISTS (
          -- Check if briefing already created in last 24 hours
          SELECT 1 FROM public.speaker_briefings sb
          WHERE sb.event_id = e.id
            AND sb.created_at > NOW() - INTERVAL '24 hours'
      )
    ORDER BY e.start_date ASC;
END;
$$;

-- 10. Create cron job to automatically generate briefings
SELECT cron.schedule(
    'speaker-briefing-generator',
    '0 * * * *', -- Run every hour
    $$
    DO $$
    DECLARE
        v_event RECORD;
        v_briefing_id UUID;
    BEGIN
        FOR v_event IN SELECT * FROM public.get_events_needing_briefings() LOOP
            -- Create briefing record
            SELECT public.create_speaker_briefing(v_event.event_id) INTO v_briefing_id;
            
            -- Log the briefing creation
            RAISE NOTICE 'Created briefing % for event %', v_briefing_id, v_event.event_id;
        END LOOP;
    END $$;
    $$
);

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.aggregate_student_discussions(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_speaker_briefing(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_briefing_content(UUID, TEXT, JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_briefing(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_briefing(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_events_needing_briefings() TO service_role;
