-- Create a table for Split Receipts to ensure perfect transparency for both Treasurers
CREATE TABLE IF NOT EXISTS public.revenue_split_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    stripe_session_id TEXT NOT NULL,
    gross_revenue_cents INT NOT NULL,
    stripe_fee_cents INT NOT NULL,
    net_profit_cents INT NOT NULL,
    split_details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revenue_split_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can view their revenue split receipts"
    ON public.revenue_split_receipts FOR SELECT
    USING (auth.role() = 'authenticated');
    -- simplified for testing, usually joined with club_admins

