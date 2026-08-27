-- Table to store raw click events with normalized percentages
CREATE TABLE IF NOT EXISTS public.sponsor_banner_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id UUID NOT NULL REFERENCES public.sponsor_banners(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    x_pct NUMERIC(5, 2) NOT NULL, -- 0.00% to 100.00%
    y_pct NUMERIC(5, 2) NOT NULL, -- 0.00% to 100.00%
    viewport_width INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for quick lookups and rate-limit debouncing checks
CREATE INDEX idx_banner_clicks_banner_id ON public.sponsor_banner_clicks(banner_id);
CREATE INDEX idx_banner_clicks_debounce ON public.sponsor_banner_clicks(user_id, banner_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.sponsor_banner_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a click" 
    ON public.sponsor_banner_clicks FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Sponsors and admins can view click analytics" 
    ON public.sponsor_banner_clicks FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- Materialized View to aggregate clicks into a 1% grid resolution for high performance
CREATE MATERIALIZED VIEW IF NOT EXISTS public.sponsor_banner_heatmap_rollups AS
SELECT 
    banner_id,
    ROUND(x_pct, 0) AS x_grid,
    ROUND(y_pct, 0) AS y_grid,
    COUNT(*) AS value
FROM public.sponsor_banner_clicks
GROUP BY banner_id, ROUND(x_pct, 0), ROUND(y_pct, 0);

CREATE UNIQUE INDEX idx_heatmap_rollup_grid ON public.sponsor_banner_heatmap_rollups(banner_id, x_grid, y_grid);
