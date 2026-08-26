-- Migration: 20261231000010_lost_member_reengagement.sql
-- Automated Post-Event "Lost Member" Re-Engagement (#3589)

-- 1. Create table for tracking detected lost members and drafted re-engagement outreach
CREATE TABLE IF NOT EXISTS public.lost_member_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_past_attended INT NOT NULL DEFAULT 0,
    days_inactive INT NOT NULL DEFAULT 60,
    last_attended_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'sent', 'dismissed')) DEFAULT 'draft',
    subject TEXT NOT NULL,
    draft_body TEXT NOT NULL,
    president_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(club_id, user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_lost_member_campaigns_club_status ON public.lost_member_campaigns(club_id, status);
CREATE INDEX IF NOT EXISTS idx_lost_member_campaigns_user ON public.lost_member_campaigns(user_id);

-- Enable RLS
ALTER TABLE public.lost_member_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Club admins / presidents can read and update campaigns for their club
CREATE POLICY "Club admins can view lost member campaigns"
    ON public.lost_member_campaigns
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = lost_member_campaigns.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.role IN ('president', 'admin', 'officer', 'leader')
        )
    );

CREATE POLICY "Club admins can update lost member campaigns"
    ON public.lost_member_campaigns
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = lost_member_campaigns.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.role IN ('president', 'admin', 'officer', 'leader')
        )
    );

CREATE POLICY "Service role full access on lost_member_campaigns"
    ON public.lost_member_campaigns
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RPC: Cron job / batch trigger to detect lost members and generate re-engagement drafts
CREATE OR REPLACE FUNCTION public.detect_lost_members_and_draft_campaigns(target_club_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted_count INT := 0;
    v_club RECORD;
    v_candidate RECORD;
    v_president RECORD;
    v_member_name TEXT;
    v_president_name TEXT;
    v_subject TEXT;
    v_draft_body TEXT;
BEGIN
    FOR v_club IN
        SELECT c.id, c.name
        FROM public.clubs c
        WHERE (target_club_id IS NULL OR c.id = target_club_id)
    LOOP
        -- Find club president or fallback officer
        SELECT cm.user_id, p.full_name, p.email
        INTO v_president
        FROM public.club_members cm
        LEFT JOIN public.profiles p ON p.id = cm.user_id
        WHERE cm.club_id = v_club.id
          AND cm.role IN ('president', 'leader', 'admin')
        ORDER BY CASE WHEN cm.role = 'president' THEN 1 WHEN cm.role = 'leader' THEN 2 ELSE 3 END
        LIMIT 1;

        v_president_name := COALESCE(v_president.full_name, 'Club President');

        -- Find lost members: attended > 3 events historically in this club, but 0 in last 60 days
        FOR v_candidate IN
            WITH member_events AS (
                SELECT 
                    r.user_id,
                    COUNT(*) as total_attended,
                    MAX(e.start_time) as last_attended,
                    COUNT(*) FILTER (WHERE e.start_time >= (now() - INTERVAL '60 days')) as recent_attended
                FROM public.event_rsvps r
                JOIN public.events e ON e.id = r.event_id
                WHERE e.club_id = v_club.id
                  AND r.status = 'attended'
                GROUP BY r.user_id
            )
            SELECT 
                me.user_id,
                me.total_attended,
                me.last_attended,
                p.full_name,
                p.email
            FROM member_events me
            JOIN public.profiles p ON p.id = me.user_id
            WHERE me.total_attended > 3
              AND me.recent_attended = 0
              -- Avoid duplicate active drafts
              AND NOT EXISTS (
                  SELECT 1 FROM public.lost_member_campaigns lmc
                  WHERE lmc.club_id = v_club.id
                    AND lmc.user_id = me.user_id
                    AND lmc.status IN ('draft', 'approved')
              )
        LOOP
            v_member_name := COALESCE(v_candidate.full_name, 'there');
            v_subject := 'We miss you at ' || v_club.name || '!';
            v_draft_body := 'Hey ' || v_member_name || ',' || E'\n\n' ||
                'We noticed we missed you at the last few ' || v_club.name || ' meetings! Hope classes and everything else are going okay.' || E'\n\n' ||
                'We would love to see you again soon. Let us know if there is anything we can do or if you have any feedback.' || E'\n\n' ||
                'Best,' || E'\n' ||
                v_president_name || ' (' || v_club.name || ' Leadership)';

            INSERT INTO public.lost_member_campaigns (
                club_id,
                user_id,
                total_past_attended,
                days_inactive,
                last_attended_at,
                status,
                subject,
                draft_body,
                president_id
            ) VALUES (
                v_club.id,
                v_candidate.user_id,
                v_candidate.total_attended,
                GREATEST(60, EXTRACT(DAY FROM (now() - v_candidate.last_attended))::INT),
                v_candidate.last_attended,
                'draft',
                v_subject,
                v_draft_body,
                v_president.user_id
            )
            ON CONFLICT (club_id, user_id, status) DO NOTHING;

            v_inserted_count := v_inserted_count + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'drafts_created', v_inserted_count
    );
END;
$$;
