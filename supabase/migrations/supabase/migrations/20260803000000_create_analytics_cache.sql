-- 1. Create the analytics cache table
CREATE TABLE IF NOT EXISTS public.analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NULL,
    category TEXT NULL,
    rsvp_count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for performance on dashboard lookups
CREATE INDEX IF NOT EXISTS idx_analytics_cache_month_category 
ON public.analytics_cache (month, category);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated admin/staff users (or service role)
CREATE POLICY "Allow authenticated read access to analytics cache" 
ON public.analytics_cache 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Stored Procedure: Refresh the Analytics Cache using ROLLUP
CREATE OR REPLACE FUNCTION public.refresh_analytics_cache()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clear stale cached metrics
    TRUNCATE TABLE public.analytics_cache;
    
    -- Insert aggregated metrics using ROLLUP
    -- Note: COALESCE ensures actual NULL categories don't collide with ROLLUP subtotal NULLs
    INSERT INTO public.analytics_cache (month, category, rsvp_count, updated_at)
    SELECT 
        date_trunc('month', e.start_time)::date AS month,
        COALESCE(c.category, 'Uncategorized') AS category,
        COUNT(r.id) AS rsvp_count,
        NOW() AS updated_at
    FROM public.rsvps r
    JOIN public.events e ON r.event_id = e.id
    JOIN public.clubs c ON e.club_id = c.id
    GROUP BY ROLLUP(date_trunc('month', e.start_time)::date, COALESCE(c.category, 'Uncategorized'));
END;
$$;

-- 5. Initial populate of the cache table
SELECT public.refresh_analytics_cache();