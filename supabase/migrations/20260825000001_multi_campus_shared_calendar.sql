-- Migration: Dynamic Multi-Campus Shared Calendar (#4521)
-- Builds on existing federation layer (20260818_multi_campus_federation.sql)
-- Adds: federation_activity_log, campus_broadcast_preferences, and unified calendar RPC.

-- 1. Federation activity log for tracking broadcast history
CREATE TABLE IF NOT EXISTS public.federation_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('broadcast', 'update', 'delete', 'ingest')),
    target_domain TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_federation_log_event ON public.federation_activity_log(event_id);
CREATE INDEX IF NOT EXISTS idx_federation_log_created ON public.federation_activity_log(created_at);

-- 2. Campus broadcast preferences per club
CREATE TABLE IF NOT EXISTS public.campus_broadcast_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    auto_broadcast BOOLEAN NOT NULL DEFAULT false,
    target_campuses TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(club_id)
);

-- 3. RPC: Get unified calendar (local events + remote_events merged by date)
CREATE OR REPLACE FUNCTION public.get_unified_calendar(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_include_remote BOOLEAN DEFAULT true,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_local_events JSONB;
    v_remote_events JSONB;
    v_all_events JSONB;
BEGIN
    -- Fetch local events
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'description', e.description,
        'start_date', e.start_date,
        'end_date', e.end_date,
        'location', e.location,
        'banner_url', e.banner_url,
        'source', 'local',
        'is_federated_public', e.is_federated_public,
        'club_name', c.name,
        'created_by', e.created_by
    ) ORDER BY e.start_date ASC), '[]'::jsonb)
    INTO v_local_events
    FROM public.events e
    LEFT JOIN public.clubs c ON e.club_id = c.id
    WHERE e.status = 'scheduled'
      AND (p_start_date IS NULL OR e.start_date >= p_start_date)
      AND (p_end_date IS NULL OR e.start_date <= p_end_date)
    LIMIT p_limit OFFSET p_offset;

    -- Fetch remote (federated) events
    IF p_include_remote THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', re.id,
            'title', re.title,
            'description', re.description,
            'start_date', re.start_time,
            'end_date', re.end_time,
            'location', re.location,
            'banner_url', re.banner_url,
            'source', 'federated',
            'host_institution', re.host_institution,
            'origin_domain', re.origin_server_domain,
            'origin_event_id', re.origin_event_id,
            'federated_payload', re.federated_payload
        ) ORDER BY re.start_time ASC), '[]'::jsonb)
        INTO v_remote_events
        FROM public.remote_events re
        WHERE (p_start_date IS NULL OR re.start_time >= p_start_date)
          AND (p_end_date IS NULL OR re.start_time <= p_end_date)
        LIMIT p_limit OFFSET p_offset;
    ELSE
        v_remote_events := '[]'::jsonb;
    END IF;

    -- Merge and sort by start_date
    SELECT jsonb_agg(event ORDER BY (event->>'start_date')::timestamptz ASC)
    INTO v_all_events
    FROM (
        SELECT jsonb_array_elements(v_local_events) AS event
        UNION ALL
        SELECT jsonb_array_elements(v_remote_events) AS event
    ) combined;

    RETURN jsonb_build_object(
        'events', COALESCE(v_all_events, '[]'::jsonb),
        'local_count', jsonb_array_length(v_local_events),
        'remote_count', jsonb_array_length(v_remote_events),
        'total_count', jsonb_array_length(COALESCE(v_all_events, '[]'::jsonb))
    );
END;
$$;

-- 4. RPC: Get federation stats for admin panel
CREATE OR REPLACE FUNCTION public.get_federation_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trusted_count INTEGER;
    v_federated_event_count INTEGER;
    v_remote_event_count INTEGER;
    v_broadcast_count INTEGER;
    v_recent_logs JSONB;
BEGIN
    SELECT COUNT(*) INTO v_trusted_count
    FROM public.federated_servers WHERE is_active = true;

    SELECT COUNT(*) INTO v_federated_event_count
    FROM public.events WHERE is_federated_public = true;

    SELECT COUNT(*) INTO v_remote_event_count
    FROM public.remote_events;

    SELECT COUNT(*) INTO v_broadcast_count
    FROM public.federation_activity_log
    WHERE action = 'broadcast' AND status = 'success'
      AND created_at > NOW() - INTERVAL '24 hours';

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', fal.id,
        'action', fal.action,
        'target_domain', fal.target_domain,
        'status', fal.status,
        'details', fal.details,
        'created_at', fal.created_at
    ) ORDER BY fal.created_at DESC), '[]'::jsonb)
    INTO v_recent_logs
    FROM public.federation_activity_log fal
    ORDER BY fal.created_at DESC
    LIMIT 20;

    RETURN jsonb_build_object(
        'trusted_campuses', v_trusted_count,
        'federated_events', v_federated_event_count,
        'remote_events_received', v_remote_event_count,
        'broadcasts_24h', v_broadcast_count,
        'recent_activity', v_recent_logs
    );
END;
$$;

-- 5. RPC: Toggle event federation broadcast
CREATE OR REPLACE FUNCTION public.toggle_event_federation(
    p_event_id UUID,
    p_is_federated BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event RECORD;
BEGIN
    -- Verify user is club admin or creator
    SELECT e.id, e.club_id, e.created_by, e.title
    INTO v_event
    FROM public.events e
    WHERE e.id = p_event_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event not found');
    END IF;

    -- Check permissions: creator or club admin
    IF v_event.created_by != auth.uid() AND NOT EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = v_event.club_id
          AND cm.user_id = auth.uid()
          AND cm.role_id IN (
            SELECT id FROM public.club_roles WHERE name IN ('president', 'admin')
          )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    UPDATE public.events
    SET is_federated_public = p_is_federated,
        updated_at = NOW()
    WHERE id = p_event_id;

    -- Log the action
    INSERT INTO public.federation_activity_log (event_id, action, status, details)
    VALUES (
        p_event_id,
        CASE WHEN p_is_federated THEN 'broadcast' ELSE 'delete' END,
        'pending',
        jsonb_build_object(
            'event_title', v_event.title,
            'toggled_by', auth.uid(),
            'is_federated', p_is_federated
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_federated_public', p_is_federated,
        'message', CASE
            WHEN p_is_federated THEN 'Event will be broadcast to partner campuses'
            ELSE 'Event federation disabled'
        END
    );
END;
$$;

-- 6. RLS policies
ALTER TABLE public.federation_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_broadcast_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can view federation logs"
    ON public.federation_activity_log
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "System can insert federation logs"
    ON public.federation_activity_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Club admins manage their broadcast preferences"
    ON public.campus_broadcast_preferences
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = campus_broadcast_preferences.club_id
              AND cm.user_id = auth.uid()
              AND cm.role_id IN (
                  SELECT id FROM public.club_roles WHERE name IN ('president', 'admin')
              )
        )
    );
