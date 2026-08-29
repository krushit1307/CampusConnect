-- Migration: 20280830000000_noise_complaint_router.sql
-- Description: Dynamic noise complaint routing schema and RPCs

-- 1. Create noise_complaints table
CREATE TABLE IF NOT EXISTS public.noise_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast counts
CREATE INDEX IF NOT EXISTS idx_noise_complaints_event ON public.noise_complaints (event_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.noise_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for complaints logs"
    ON public.noise_complaints FOR SELECT
    USING (true);

-- 2. submit_noise_complaint function to automatically route complaint
CREATE OR REPLACE FUNCTION public.submit_noise_complaint(
    p_reporter_id UUID,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
    v_organizer_id UUID;
    v_complaint_count INT;
    v_event_title TEXT;
BEGIN
    -- Find closest active event within 500 feet (0.1524 km) using haversine_distance
    SELECT id, organizer_id, title INTO v_event_id, v_organizer_id, v_event_title
    FROM public.events
    WHERE start_time <= NOW() AND end_time >= NOW()
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND public.haversine_distance(p_latitude, p_longitude, latitude, longitude) <= 0.1524
    ORDER BY public.haversine_distance(p_latitude, p_longitude, latitude, longitude) ASC
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active events found within 500 feet of your location.');
    END IF;

    -- Insert complaint record
    INSERT INTO public.noise_complaints (reporter_id, latitude, longitude, event_id)
    VALUES (p_reporter_id, p_latitude, p_longitude, v_event_id);

    -- Tally complaints in last 15 minutes
    SELECT COUNT(*) INTO v_complaint_count
    FROM public.noise_complaints
    WHERE event_id = v_event_id AND created_at >= NOW() - INTERVAL '15 minutes';

    -- If >= 3 complaints in the last 15 minutes, notify the organizer
    IF v_complaint_count >= 3 THEN
        INSERT INTO public.notifications (user_id, title, message, link, type)
        VALUES (
            v_organizer_id,
            '🚨 URGENT: Noise Violation Warning',
            'URGENT: 3 Noise Complaints from nearby dorms. Turn down the music immediately or Campus Police will be dispatched.',
            '/events/' || v_event_id,
            'noise_warning'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'event_title', v_event_title,
        'complaint_count', v_complaint_count,
        'organizer_id', v_organizer_id
    );
END;
$$;
