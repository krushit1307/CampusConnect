-- Issue #4415: Dynamic "Club Revenue" Profit-Sharing

ALTER TABLE public.co_sponsors 
ADD COLUMN IF NOT EXISTS revenue_split JSONB,
ADD COLUMN IF NOT EXISTS revenue_split_signatures JSONB;

-- Comment on new columns
COMMENT ON COLUMN public.co_sponsors.revenue_split IS 'JSON defining the profit split percentages (e.g., {"club_1_id": 60, "club_2_id": 40})';
COMMENT ON COLUMN public.co_sponsors.revenue_split_signatures IS 'JSON storing digital signatures from both clubs confirming the split.';

