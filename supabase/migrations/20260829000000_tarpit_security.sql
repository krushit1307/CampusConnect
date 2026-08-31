-- ============================================================
-- Migration: 20260829000000_tarpit_security.sql
-- Issue: #4995 - Dynamic "Early Bird" Rate-Limiting Tarpit
-- Description:
--   1. Adds tarpit tracking table for bot behavior patterns
--   2. Adds tarpit configuration table
--   3. Creates RPC functions for tarpit management
--   4. Adds security event logging for tarpit activations
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create tarpit_sessions table to track bot sessions
CREATE TABLE IF NOT EXISTS public.tarpit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    fingerprint TEXT,
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    duration_seconds INT,
    bytes_sent INT DEFAULT 0,
    config_bps NUMERIC(10,2),
    config_max_duration INT,
    trigger_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    connection_count INT DEFAULT 1,
    
    -- Indexes for querying
    CONSTRAINT chk_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Indexes for tarpit_sessions
CREATE INDEX IF NOT EXISTS idx_tarpit_sessions_ip ON public.tarpit_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_tarpit_sessions_fingerprint ON public.tarpit_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_tarpit_sessions_active ON public.tarpit_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tarpit_sessions_start ON public.tarpit_sessions(session_start DESC);

-- 2. Create tarpit_config table for dynamic configuration
CREATE TABLE IF NOT EXISTS public.tarpit_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT UNIQUE NOT NULL,
    bytes_per_second NUMERIC(10,2) NOT NULL DEFAULT 0.1,
    max_duration INT NOT NULL DEFAULT 300,
    chunk_size INT NOT NULL DEFAULT 1,
    initial_delay INT NOT NULL DEFAULT 1000,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO public.tarpit_config (config_name, bytes_per_second, max_duration, chunk_size, initial_delay, description)
VALUES 
    ('default', 0.1, 300, 1, 1000, 'Default tarpit: 1 byte per 10 seconds, 5 min max'),
    ('aggressive', 0.05, 600, 1, 2000, 'Aggressive tarpit: 1 byte per 20 seconds, 10 min max'),
    ('light', 0.5, 120, 2, 500, 'Light tarpit: 1 byte per 2 seconds, 2 min max')
ON CONFLICT (config_name) DO NOTHING;

-- 3. Create tarpit_events table for monitoring
CREATE TABLE IF NOT EXISTS public.tarpit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'session_start', 'session_end', 'config_change'
    ip_address TEXT,
    fingerprint TEXT,
    config_name TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarpit_events_type ON public.tarpit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tarpit_events_timestamp ON public.tarpit_events(timestamp DESC);

-- 4. Create function to start a tarpit session
CREATE OR REPLACE FUNCTION public.start_tarpit_session(
    p_ip_address TEXT,
    p_user_agent TEXT DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_config_name TEXT DEFAULT 'default',
    p_trigger_reason TEXT DEFAULT 'honey_pot'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config RECORD;
    v_session_id UUID;
BEGIN
    -- Get configuration
    SELECT * INTO v_config
    FROM public.tarpit_config
    WHERE config_name = p_config_name AND enabled = TRUE;
    
    IF NOT FOUND THEN
        -- Fallback to default config
        SELECT * INTO v_config
        FROM public.tarpit_config
        WHERE config_name = 'default';
    END IF;
    
    -- Create session
    INSERT INTO public.tarpit_sessions (
        ip_address,
        user_agent,
        fingerprint,
        config_bps,
        config_max_duration,
        trigger_reason
    ) VALUES (
        p_ip_address,
        p_user_agent,
        p_fingerprint,
        v_config.bytes_per_second,
        v_config.max_duration,
        p_trigger_reason
    ) RETURNING id INTO v_session_id;
    
    -- Log event
    INSERT INTO public.tarpit_events (event_type, ip_address, fingerprint, config_name, details)
    VALUES (
        'session_start',
        p_ip_address,
        p_fingerprint,
        p_config_name,
        jsonb_build_object(
            'session_id', v_session_id,
            'trigger_reason', p_trigger_reason,
            'config', jsonb_build_object(
                'bytes_per_second', v_config.bytes_per_second,
                'max_duration', v_config.max_duration,
                'chunk_size', v_config.chunk_size
            )
        )
    );
    
    -- Log to security audit log
    INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
    VALUES ('tarpit', 'INSERT', 'tarpit_sessions', v_session_id);
    
    RETURN v_session_id;
END;
$$;

-- 5. Create function to end a tarpit session
CREATE OR REPLACE FUNCTION public.end_tarpit_session(
    p_session_id UUID,
    p_bytes_sent INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
BEGIN
    -- Get session
    SELECT * INTO v_session
    FROM public.tarpit_sessions
    WHERE id = p_session_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Update session
    UPDATE public.tarpit_sessions
    SET 
        session_end = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INT,
        bytes_sent = p_bytes_sent,
        is_active = FALSE
    WHERE id = p_session_id;
    
    -- Log event
    INSERT INTO public.tarpit_events (event_type, ip_address, fingerprint, details)
    VALUES (
        'session_end',
        v_session.ip_address,
        v_session.fingerprint,
        jsonb_build_object(
            'session_id', p_session_id,
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_session.session_start))::INT,
            'bytes_sent', p_bytes_sent
        )
    );
END;
$$;

-- 6. Create function to get tarpit configuration
CREATE OR REPLACE FUNCTION public.get_tarpit_config(p_config_name TEXT DEFAULT 'default')
RETURNS TABLE (
    bytes_per_second NUMERIC,
    max_duration INT,
    chunk_size INT,
    initial_delay INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.bytes_per_second,
        tc.max_duration,
        tc.chunk_size,
        tc.initial_delay
    FROM public.tarpit_config tc
    WHERE tc.config_name = COALESCE(p_config_name, 'default') AND tc.enabled = TRUE
    LIMIT 1;
END;
$$;

-- 7. Create function to check if IP/fingerprint is already in tarpit
CREATE OR REPLACE FUNCTION public.is_in_tarpit(
    p_ip_address TEXT DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL
)
RETURNS TABLE (
    in_tarpit BOOLEAN,
    session_id UUID,
    config_bps NUMERIC,
    remaining_seconds INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
BEGIN
    -- Check by fingerprint first (more reliable for proxy rotation)
    IF p_fingerprint IS NOT NULL THEN
        SELECT * INTO v_session
        FROM public.tarpit_sessions
        WHERE fingerprint = p_fingerprint 
          AND is_active = TRUE
          AND session_start > NOW() - (config_max_duration || ' seconds')::INTERVAL
        ORDER BY session_start DESC
        LIMIT 1;
    END IF;
    
    -- If not found by fingerprint, check by IP
    IF v_session IS NULL AND p_ip_address IS NOT NULL THEN
        SELECT * INTO v_session
        FROM public.tarpit_sessions
        WHERE ip_address = p_ip_address 
          AND is_active = TRUE
          AND session_start > NOW() - (config_max_duration || ' seconds')::INTERVAL
        ORDER BY session_start DESC
        LIMIT 1;
    END IF;
    
    IF v_session IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            TRUE::BOOLEAN,
            v_session.id,
            v_session.config_bps,
            GREATEST(0, v_session.config_max_duration - EXTRACT(EPOCH FROM (NOW() - v_session.session_start))::INT)::INT;
    ELSE
        RETURN QUERY
        SELECT FALSE::BOOLEAN, NULL::UUID, NULL::NUMERIC, NULL::INT;
    END IF;
END;
$$;

-- 8. Create function to get tarpit statistics
CREATE OR REPLACE FUNCTION public.get_tarpit_stats(p_days INT DEFAULT 7)
RETURNS TABLE (
    total_sessions INT,
    active_sessions INT,
    total_duration_seconds BIGINT,
    total_bytes_sent BIGINT,
    avg_duration_seconds NUMERIC,
    unique_ips INT,
    unique_fingerprints INT,
    top_trigger_reasons JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH Stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE session_start > NOW() - (p_days || ' days')::INTERVAL) as total,
            COUNT(*) FILTER (WHERE is_active = TRUE) as active,
            COALESCE(SUM(duration_seconds), 0) as total_duration,
            COALESCE(SUM(bytes_sent), 0) as total_bytes,
            COALESCE(AVG(duration_seconds), 0) as avg_duration,
            COUNT(DISTINCT ip_address) as unique_ips,
            COUNT(DISTINCT fingerprint) as unique_fps
        FROM public.tarpit_sessions
        WHERE session_start > NOW() - (p_days || ' days')::INTERVAL
    ),
    TopReasons AS (
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'reason', trigger_reason,
                    'count', count
                )
            ) as reasons
        FROM (
            SELECT trigger_reason, COUNT(*) as count
            FROM public.tarpit_sessions
            WHERE session_start > NOW() - (p_days || ' days')::INTERVAL
            GROUP BY trigger_reason
            ORDER BY count DESC
            LIMIT 5
        ) t
    )
    SELECT 
        s.total::INT,
        s.active::INT,
        s.total_duration::BIGINT,
        s.total_bytes::BIGINT,
        s.avg_duration::NUMERIC,
        s.unique_ips::INT,
        s.unique_fps::INT,
        COALESCE(tr.reasons, '[]'::jsonb)
    FROM Stats s
    CROSS JOIN TopReasons tr;
END;
$$;

-- 9. Enable RLS
ALTER TABLE public.tarpit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarpit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarpit_events ENABLE ROW LEVEL SECURITY;

-- Policies for tarpit_sessions (admin only)
CREATE POLICY "Admins can view tarpit sessions" ON public.tarpit_sessions
FOR SELECT TO authenticated
USING (public.is_system_admin());

CREATE POLICY "System can insert tarpit sessions" ON public.tarpit_sessions
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "System can update tarpit sessions" ON public.tarpit_sessions
FOR UPDATE TO service_role
WITH CHECK (true);

-- Policies for tarpit_config (admin only)
CREATE POLICY "Admins can view tarpit config" ON public.tarpit_config
FOR SELECT TO authenticated
USING (public.is_system_admin());

CREATE POLICY "Admins can update tarpit config" ON public.tarpit_config
FOR UPDATE TO authenticated
USING (public.is_system_admin());

CREATE POLICY "System can insert tarpit config" ON public.tarpit_config
FOR INSERT TO service_role
WITH CHECK (true);

-- Policies for tarpit_events (admin only)
CREATE POLICY "Admins can view tarpit events" ON public.tarpit_events
FOR SELECT TO authenticated
USING (public.is_system_admin());

CREATE POLICY "System can insert tarpit events" ON public.tarpit_events
FOR INSERT TO service_role
WITH CHECK (true);

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.start_tarpit_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_tarpit_session(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tarpit_config(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_in_tarpit(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_tarpit_stats(INT) TO authenticated;
