-- Migration: 20261122000000_merch_crowdfunding.sql
-- Description: Implement Kickstarter-style merchandise crowdfunding schema, preorders, and cron evaluator (#3453).

-- 1. Alter public.merch_items to support campaigns
ALTER TABLE public.merch_items
ADD COLUMN IF NOT EXISTS funding_goal_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS campaign_end_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS campaign_status TEXT DEFAULT 'active' CHECK (campaign_status IN ('active', 'succeeded', 'failed'));

-- 2. Create public.merch_preorders table
CREATE TABLE IF NOT EXISTS public.merch_preorders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merch_item_id UUID NOT NULL REFERENCES public.merch_items(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.merch_variants(id) ON DELETE CASCADE,
    payment_method_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CONSTRAINT preorder_quantity_positive CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'released')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, variant_id)
);

-- Enable RLS
ALTER TABLE public.merch_preorders ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Users can read own preorders" ON public.merch_preorders;
CREATE POLICY "Users can read own preorders" ON public.merch_preorders
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.merch_items mi
            JOIN public.club_members cm ON cm.club_id = mi.club_id
            WHERE mi.id = merch_preorders.merch_item_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'executive'
        )
    );

-- Insert policy
DROP POLICY IF EXISTS "Users can insert own preorders" ON public.merch_preorders;
CREATE POLICY "Users can insert own preorders" ON public.merch_preorders
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Service role full access policy
DROP POLICY IF EXISTS "Service role has full access to preorders" ON public.merch_preorders;
CREATE POLICY "Service role has full access to preorders" ON public.merch_preorders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Create evaluation cron function
CREATE OR REPLACE FUNCTION public.evaluate_crowdfunding_campaigns()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_campaign RECORD;
    v_total_orders INTEGER;
    r_preorder RECORD;
BEGIN
    -- Loop through active campaigns that have expired
    FOR r_campaign IN 
        SELECT id, name, funding_goal_count, campaign_end_date
        FROM public.merch_items
        WHERE campaign_status = 'active'
          AND campaign_end_date IS NOT NULL
          AND campaign_end_date <= NOW()
    LOOP
        -- Calculate total preordered items (sum of quantities across all variants)
        SELECT COALESCE(SUM(quantity), 0) INTO v_total_orders
        FROM public.merch_preorders
        WHERE merch_item_id = r_campaign.id
          AND status = 'pending';

        IF v_total_orders >= r_campaign.funding_goal_count THEN
            -- Success! Charge cards (in simulation, we capture them)
            UPDATE public.merch_items
            SET campaign_status = 'succeeded', updated_at = NOW()
            WHERE id = r_campaign.id;

            UPDATE public.merch_preorders
            SET status = 'captured', updated_at = NOW()
            WHERE merch_item_id = r_campaign.id
              AND status = 'pending';

            -- Insert notifications for success
            FOR r_preorder IN 
                SELECT DISTINCT user_id FROM public.merch_preorders
                WHERE merch_item_id = r_campaign.id AND status = 'captured'
            LOOP
                IF EXISTS (
                    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                    WHERE c.relname = 'notifications' AND n.nspname = 'public'
                ) THEN
                    INSERT INTO public.notifications (user_id, type, title, message)
                    VALUES (
                        r_preorder.user_id,
                        'merch_crowdfund_success',
                        'Crowdfunding Goal Met! 🎉',
                        'The pre-order campaign for "' || r_campaign.name || '" succeeded! Your card has been processed.'
                    );
                END IF;
            END LOOP;

        ELSE
            -- Failed! Release holds
            UPDATE public.merch_items
            SET campaign_status = 'failed', updated_at = NOW()
            WHERE id = r_campaign.id;

            UPDATE public.merch_preorders
            SET status = 'released', updated_at = NOW()
            WHERE merch_item_id = r_campaign.id
              AND status = 'pending';

            -- Insert notifications for failure
            FOR r_preorder IN 
                SELECT DISTINCT user_id FROM public.merch_preorders
                WHERE merch_item_id = r_campaign.id AND status = 'released'
            LOOP
                IF EXISTS (
                    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                    WHERE c.relname = 'notifications' AND n.nspname = 'public'
                ) THEN
                    INSERT INTO public.notifications (user_id, type, title, message)
                    VALUES (
                        r_preorder.user_id,
                        'merch_crowdfund_failure',
                        'Crowdfunding Goal Not Met 😔',
                        'The pre-order campaign for "' || r_campaign.name || '" did not reach its goal by the deadline. No charges were made.'
                    );
                END IF;
            END LOOP;
        END IF;

    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_crowdfunding_campaigns() TO authenticated;

-- 4. Register pg_cron schedule daily at midnight
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
        'evaluate-merch-crowdfunding',
        '0 0 * * *',
        'SELECT public.evaluate_crowdfunding_campaigns()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
