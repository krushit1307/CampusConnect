-- Migration: 20260854000000_event_roi_visualization.sql
-- Description: Interactive Event ROI Visualization Dashboard with Sankey Flow and Net Loss Highlighting (#4280)

CREATE TABLE IF NOT EXISTS public.event_financial_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'revenue' or 'expense'
  category TEXT NOT NULL, -- 'Ticket Sales', 'Sponsorships', 'Catering', 'Venue', etc.
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event lookup
CREATE INDEX IF NOT EXISTS idx_event_financial_tx_event ON public.event_financial_transactions(event_id, type);

-- Enable RLS
ALTER TABLE public.event_financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event financial transactions"
ON public.event_financial_transactions FOR SELECT
USING (true);

CREATE POLICY "Authenticated insert event financial transactions"
ON public.event_financial_transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RPC for aggregating event ROI Sankey data
CREATE OR REPLACE FUNCTION public.get_event_roi_sankey_data(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_revenue NUMERIC(12, 2);
  v_total_expenses NUMERIC(12, 2);
  v_net_amount NUMERIC(12, 2);
  v_roi_pct NUMERIC(10, 2);
  v_is_profit BOOLEAN;
  v_nodes JSONB;
  v_links JSONB;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM public.event_financial_transactions
  WHERE event_id = p_event_id AND type = 'revenue';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM public.event_financial_transactions
  WHERE event_id = p_event_id AND type = 'expense';

  v_net_amount := v_total_revenue - v_total_expenses;
  v_is_profit := v_net_amount >= 0;

  IF v_total_expenses > 0 THEN
    v_roi_pct := ROUND(((v_net_amount / v_total_expenses) * 100)::numeric, 2);
  ELSE
    v_roi_pct := 0;
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses,
    'net_amount', v_net_amount,
    'roi_percentage', v_roi_pct,
    'is_profit', v_is_profit
  );
END;
$$;

GRANT ALL ON public.event_financial_transactions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_event_roi_sankey_data(UUID) TO authenticated, anon;
