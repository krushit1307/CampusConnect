-- Migration: 20280829000000_event_layout_vendor_bidding.sql
-- Description: Interactive Event Layout Vendor Bidding database schema and RPCs

-- 1. Extend events table to support layout bidding deadline
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS layout_bidding_deadline TIMESTAMPTZ;

-- 2. Extend sponsor_table_bids table
ALTER TABLE public.sponsor_table_bids ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT;
ALTER TABLE public.sponsor_table_bids ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Recreate constraint on status to include 'completed'
ALTER TABLE public.sponsor_table_bids DROP CONSTRAINT IF EXISTS sponsor_table_bids_status_check;
ALTER TABLE public.sponsor_table_bids ADD CONSTRAINT sponsor_table_bids_status_check CHECK (status IN ('active', 'outbid', 'cancelled', 'completed'));

-- 3. Helper function to update the sponsor assignment inside event floorplan_json
CREATE OR REPLACE FUNCTION public.assign_sponsor_to_table_node(
    p_event_id UUID,
    p_table_node_id TEXT,
    p_sponsor_id TEXT,
    p_company_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_floorplan JSONB;
    v_assets JSONB;
    v_new_assets JSONB := '[]'::jsonb;
    v_asset JSONB;
BEGIN
    SELECT floorplan_json INTO v_floorplan FROM public.events WHERE id = p_event_id;
    IF v_floorplan IS NOT NULL AND v_floorplan ? 'assets' THEN
        v_assets := v_floorplan->'assets';
        FOR v_asset IN SELECT * FROM jsonb_array_elements(v_assets) LOOP
            IF v_asset->>'id' = p_table_node_id THEN
                v_asset := jsonb_set(
                    v_asset,
                    '{assignment}',
                    jsonb_build_object('sponsorId', p_sponsor_id, 'companyName', p_company_name)
                );
            END IF;
            v_new_assets := v_new_assets || v_asset;
        END LOOP;
        UPDATE public.events
        SET floorplan_json = jsonb_set(v_floorplan, '{assets}', v_new_assets)
        WHERE id = p_event_id;
    END IF;
END;
$$;

-- 4. RPC function to place a sponsor table bid
CREATE OR REPLACE FUNCTION public.place_sponsor_table_bid(
    p_event_id UUID,
    p_sponsorship_id UUID,
    p_table_node_id TEXT,
    p_bid_amount NUMERIC,
    p_logo_url TEXT,
    p_target_link_url TEXT,
    p_setup_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_price NUMERIC := 0;
    v_highest_bid NUMERIC := 0;
    v_outbid_sponsor RECORD;
    v_new_bid_id UUID;
    v_deadline TIMESTAMPTZ;
    v_company_name TEXT;
BEGIN
    -- 1. Check if deadline has passed
    SELECT layout_bidding_deadline INTO v_deadline
    FROM public.events
    WHERE id = p_event_id;

    IF v_deadline IS NOT NULL AND NOW() >= v_deadline THEN
        RAISE EXCEPTION 'Bidding has already closed for this event layout.';
    END IF;

    -- 2. Fetch base_price from floorplan_json
    SELECT COALESCE((elem->>'base_price')::numeric, 0) INTO v_base_price
    FROM public.events e,
         jsonb_array_elements(COALESCE(e.floorplan_json->'assets', '[]'::jsonb)) AS elem
    WHERE e.id = p_event_id AND elem->>'id' = p_table_node_id;

    IF v_bid_amount < v_base_price THEN
        RAISE EXCEPTION 'Bid amount % must be at least the base price %.', p_bid_amount, v_base_price;
    END IF;

    -- 3. Check current highest bid
    SELECT COALESCE(MAX(winning_bid_amount), 0) INTO v_highest_bid
    FROM public.sponsor_table_bids
    WHERE event_id = p_event_id AND table_node_id = p_table_node_id AND status = 'active';

    IF p_bid_amount <= v_highest_bid THEN
        RAISE EXCEPTION 'Bid amount % must be higher than the current highest active bid %.', p_bid_amount, v_highest_bid;
    END IF;

    -- 4. Get outbid sponsor details (if any)
    SELECT b.*, c.sponsor_user_id
    INTO v_outbid_sponsor
    FROM public.sponsor_table_bids b
    JOIN public.corporate_sponsorships c ON b.sponsorship_id = c.id
    WHERE b.event_id = p_event_id AND b.table_node_id = p_table_node_id AND b.status = 'active';

    -- 5. Mark previous active bid as outbid
    UPDATE public.sponsor_table_bids
    SET status = 'outbid'
    WHERE event_id = p_event_id AND table_node_id = p_table_node_id AND status = 'active';

    -- 6. Fetch company name from sponsorship record
    SELECT company_name INTO v_company_name
    FROM public.corporate_sponsorships
    WHERE id = p_sponsorship_id;

    -- 7. Insert the new active bid
    INSERT INTO public.sponsor_table_bids (
        event_id, sponsorship_id, table_node_id, winning_bid_amount, logo_url, target_link_url, status, stripe_setup_intent_id
    ) VALUES (
        p_event_id, p_sponsorship_id, p_table_node_id, p_bid_amount, p_logo_url, p_target_link_url, 'active', p_setup_intent_id
    ) RETURNING id INTO v_new_bid_id;

    -- 8. If someone was outbid, insert a notification for them
    IF v_outbid_sponsor.sponsor_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, link, type)
        VALUES (
            v_outbid_sponsor.sponsor_user_id,
            '⚠️ Outbid Alert!',
            'You have been outbid for table ' || p_table_node_id || ' by ' || v_company_name || '. New highest bid: $' || p_bid_amount,
            '/events/' || p_event_id || '/floorplan',
            'outbid_alert'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bid_id', v_new_bid_id,
        'outbid_user_id', v_outbid_sponsor.sponsor_user_id,
        'outbid_email', (SELECT email FROM auth.users WHERE id = v_outbid_sponsor.sponsor_user_id)
    );
END;
$$;

-- 5. RPC function to resolve layout bidding at the deadline
CREATE OR REPLACE FUNCTION public.resolve_layout_bidding(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bid RECORD;
    v_success_count INT := 0;
    v_sponsor_id TEXT;
BEGIN
    -- Iterate over all active bids for this event
    FOR v_bid IN 
        SELECT b.*, c.sponsor_user_id
        FROM public.sponsor_table_bids b
        JOIN public.corporate_sponsorships c ON b.sponsorship_id = c.id
        WHERE b.event_id = p_event_id AND b.status = 'active'
    LOOP
        -- 1. Assign sponsor_id to the table node in floorplan_json
        v_sponsor_id := COALESCE(v_bid.sponsor_user_id::text, '');
        PERFORM public.assign_sponsor_to_table_node(p_event_id, v_bid.table_node_id, v_sponsor_id, v_bid.company_name);

        -- 2. Mark bid as completed
        UPDATE public.sponsor_table_bids
        SET status = 'completed'
        WHERE id = v_bid.id;

        v_success_count := v_success_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'resolved_count', v_success_count);
END;
$$;
