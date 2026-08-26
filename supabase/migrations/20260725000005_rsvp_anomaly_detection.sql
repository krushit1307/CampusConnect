-- Migration: 20260725000003_rsvp_anomaly_detection.sql
-- Description: Implement K-means clustering for RSVP anomaly detection to detect bot networks

-- 1. Add IP Address to event_rsvps to track distribution
ALTER TABLE public.event_rsvps 
ADD COLUMN IF NOT EXISTS ip_address INET;

-- 2. Create materialized view for user behavioral vectors
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_rsvp_metrics AS
SELECT 
    user_id,
    COUNT(id) AS total_rsvps,
    COUNT(DISTINCT ip_address) AS unique_ips,
    COUNT(id) FILTER (WHERE rsvp_at >= NOW() - INTERVAL '24 hours') AS rsvps_last_24h,
    COALESCE(
        EXTRACT(EPOCH FROM (MAX(rsvp_at) - MIN(rsvp_at))) / NULLIF(COUNT(id) - 1, 0),
        0
    ) AS avg_interval_seconds
FROM public.event_rsvps
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rsvp_metrics_user_id ON public.user_rsvp_metrics(user_id);

-- 3. Create tables for clustering and alerts
CREATE TABLE IF NOT EXISTS public.rsvp_anomaly_clusters (
    cluster_id INT PRIMARY KEY,
    centroid_total_rsvps FLOAT,
    centroid_unique_ips FLOAT,
    centroid_rsvps_last_24h FLOAT,
    centroid_avg_interval FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rsvp_anomaly_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    cluster_id INT REFERENCES public.rsvp_anomaly_clusters(cluster_id) ON DELETE SET NULL,
    total_rsvps INT,
    unique_ips INT,
    rsvps_last_24h INT,
    avg_interval_seconds FLOAT,
    distance_to_centroid FLOAT,
    is_quarantined BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rsvp_anomaly_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view anomaly alerts" ON public.rsvp_anomaly_alerts;
CREATE POLICY "System admins can view anomaly alerts" ON public.rsvp_anomaly_alerts
FOR SELECT USING (public.is_system_admin());

-- 4. K-means implementation
CREATE OR REPLACE FUNCTION public.update_rsvp_kmeans_clusters(k INT DEFAULT 3, max_iterations INT DEFAULT 10)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INT;
    has_changed BOOLEAN;
BEGIN
    -- Refresh data
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_rsvp_metrics;
    
    -- Initialize centroids randomly
    DELETE FROM public.rsvp_anomaly_clusters;
    
    -- We need at least K distinct users to form clusters
    -- If there are less than K users, we just take all of them as centroids
    INSERT INTO public.rsvp_anomaly_clusters (
        cluster_id, centroid_total_rsvps, centroid_unique_ips, centroid_rsvps_last_24h, centroid_avg_interval
    )
    SELECT 
        row_number() OVER () AS cluster_id,
        total_rsvps,
        unique_ips,
        rsvps_last_24h,
        avg_interval_seconds
    FROM public.user_rsvp_metrics
    ORDER BY random()
    LIMIT k;

    CREATE TEMP TABLE IF NOT EXISTS temp_user_cluster_assignments (
        user_id UUID PRIMARY KEY,
        cluster_id INT
    ) ON COMMIT DROP;
    
    TRUNCATE temp_user_cluster_assignments;

    -- Lloyd's algorithm iteration
    FOR i IN 1..max_iterations LOOP
        has_changed := FALSE;
        
        WITH assignments AS (
            SELECT 
                u.user_id,
                (
                    SELECT c.cluster_id
                    FROM public.rsvp_anomaly_clusters c
                    ORDER BY 
                        POWER(c.centroid_total_rsvps - u.total_rsvps, 2) +
                        POWER(c.centroid_unique_ips - u.unique_ips, 2) +
                        POWER(c.centroid_rsvps_last_24h - COALESCE(u.rsvps_last_24h, 0), 2) +
                        POWER(c.centroid_avg_interval - u.avg_interval_seconds, 2)
                    ASC LIMIT 1
                ) AS new_cluster_id
            FROM public.user_rsvp_metrics u
        ),
        updates AS (
            INSERT INTO temp_user_cluster_assignments (user_id, cluster_id)
            SELECT user_id, new_cluster_id FROM assignments
            ON CONFLICT (user_id) DO UPDATE 
            SET cluster_id = EXCLUDED.cluster_id
            WHERE temp_user_cluster_assignments.cluster_id IS DISTINCT FROM EXCLUDED.cluster_id
            RETURNING 1
        )
        SELECT EXISTS(SELECT 1 FROM updates) INTO has_changed;

        IF NOT has_changed THEN
            EXIT;
        END IF;

        UPDATE public.rsvp_anomaly_clusters c
        SET 
            centroid_total_rsvps = sub.avg_total_rsvps,
            centroid_unique_ips = sub.avg_unique_ips,
            centroid_rsvps_last_24h = sub.avg_rsvps_last_24h,
            centroid_avg_interval = sub.avg_interval_seconds,
            updated_at = NOW()
        FROM (
            SELECT 
                t.cluster_id,
                AVG(u.total_rsvps) AS avg_total_rsvps,
                AVG(u.unique_ips) AS avg_unique_ips,
                AVG(COALESCE(u.rsvps_last_24h, 0)) AS avg_rsvps_last_24h,
                AVG(u.avg_interval_seconds) AS avg_interval_seconds
            FROM temp_user_cluster_assignments t
            JOIN public.user_rsvp_metrics u ON u.user_id = t.user_id
            GROUP BY t.cluster_id
        ) sub
        WHERE c.cluster_id = sub.cluster_id;
        
    END LOOP;
END;
$$;

-- 5. Detect anomalies
CREATE OR REPLACE FUNCTION public.detect_rsvp_anomalies()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_cluster INT;
BEGIN
    -- Identify the anomalous bot cluster
    -- Bot behavior: high recent RSVPs, very low average interval, maybe single or few IPs
    -- We select the cluster with the highest RSVPs in last 24h as a candidate
    SELECT cluster_id INTO v_target_cluster
    FROM public.rsvp_anomaly_clusters
    ORDER BY centroid_rsvps_last_24h DESC, centroid_avg_interval ASC
    LIMIT 1;
    
    IF v_target_cluster IS NULL THEN
        RETURN;
    END IF;

    -- Flag everyone who falls into the most active cluster if their personal velocity is also high.
    INSERT INTO public.rsvp_anomaly_alerts (
        user_id, cluster_id, total_rsvps, unique_ips, rsvps_last_24h, avg_interval_seconds, distance_to_centroid, is_quarantined
    )
    SELECT 
        u.user_id,
        v_target_cluster,
        u.total_rsvps,
        u.unique_ips,
        COALESCE(u.rsvps_last_24h, 0),
        u.avg_interval_seconds,
        (
            SELECT 
                POWER(c.centroid_total_rsvps - u.total_rsvps, 2) +
                POWER(c.centroid_unique_ips - u.unique_ips, 2) +
                POWER(c.centroid_rsvps_last_24h - COALESCE(u.rsvps_last_24h, 0), 2) +
                POWER(c.centroid_avg_interval - u.avg_interval_seconds, 2)
            FROM public.rsvp_anomaly_clusters c WHERE c.cluster_id = v_target_cluster
        ) AS dist,
        TRUE -- Quarantine automatically
    FROM public.user_rsvp_metrics u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.rsvp_anomaly_alerts a 
        WHERE a.user_id = u.user_id 
        AND a.detected_at > NOW() - INTERVAL '1 day'
    )
    AND COALESCE(u.rsvps_last_24h, 0) > 10 -- Minimum threshold to be considered for botting
    AND (
        SELECT c.cluster_id
        FROM public.rsvp_anomaly_clusters c
        ORDER BY 
            POWER(c.centroid_total_rsvps - u.total_rsvps, 2) +
            POWER(c.centroid_unique_ips - u.unique_ips, 2) +
            POWER(c.centroid_rsvps_last_24h - COALESCE(u.rsvps_last_24h, 0), 2) +
            POWER(c.centroid_avg_interval - u.avg_interval_seconds, 2)
        ASC LIMIT 1
    ) = v_target_cluster;

END;
$$;

-- 6. Setup pg_cron
-- We will dynamically try to enable pg_cron if it exists
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Safely try to unschedule if it exists
        BEGIN
            PERFORM cron.unschedule('update-rsvp-kmeans');
        EXCEPTION WHEN OTHERS THEN
            -- Ignore
        END;
        
        PERFORM cron.schedule('update-rsvp-kmeans', '0 * * * *', 'SELECT public.update_rsvp_kmeans_clusters(3, 10); SELECT public.detect_rsvp_anomalies();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to schedule cron job for anomaly detection: %', SQLERRM;
END $$;
