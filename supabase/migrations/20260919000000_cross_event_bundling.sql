-- Migration: 20260919000000_cross_event_bundling.sql
-- Description: Issue #3875 - Implement 'Cross-Event Bundling' for Ticket Sales

-- 1. Create ticket_bundles table
CREATE TABLE IF NOT EXISTS public.ticket_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    bundle_name TEXT NOT NULL, -- e.g. "Classic Cinema Series - Season Pass"
    description TEXT,
    price_dollars NUMERIC(10, 2) NOT NULL, -- Bulk price e.g. $18.00
    original_total_price NUMERIC(10, 2) NOT NULL DEFAULT 25.00, -- Sum of individual ticket prices e.g. $25.00
    discount_percentage INT NOT NULL DEFAULT 28,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'ARCHIVED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create bundle_events join table
CREATE TABLE IF NOT EXISTS public.bundle_events (
    bundle_id UUID NOT NULL REFERENCES public.ticket_bundles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bundle_id, event_id)
);

-- 3. Create bundle_purchases table
CREATE TABLE IF NOT EXISTS public.bundle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES public.ticket_bundles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_paid NUMERIC(10, 2) NOT NULL,
    stripe_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED' | 'REFUNDED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ticket_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Ticket bundles viewable by everyone" ON public.ticket_bundles;
CREATE POLICY "Ticket bundles viewable by everyone" ON public.ticket_bundles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ticket bundles manageable by authenticated users" ON public.ticket_bundles;
CREATE POLICY "Ticket bundles manageable by authenticated users" ON public.ticket_bundles FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Bundle events viewable by everyone" ON public.bundle_events;
CREATE POLICY "Bundle events viewable by everyone" ON public.bundle_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Bundle purchases readable by owner" ON public.bundle_purchases;
CREATE POLICY "Bundle purchases readable by owner" ON public.bundle_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_bundles;

-- 4. RPC function to check bundle availability and execute bulk purchase + RSVPs
CREATE OR REPLACE FUNCTION public.purchase_ticket_bundle_transaction(
    p_bundle_id UUID,
    p_user_id UUID,
    p_stripe_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bundle RECORD;
    v_event RECORD;
    v_rsvps_created INT := 0;
    v_purchase_id UUID;
BEGIN
    -- Query ticket bundle
    SELECT * INTO v_bundle FROM public.ticket_bundles WHERE id = p_bundle_id AND status = 'ACTIVE';
    IF v_bundle.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ticket bundle not found or archived');
    END IF;

    -- Check if any underlying event in bundle is sold out
    FOR v_event IN
        SELECT e.id, e.title, e.max_attendees, e.rsvp_count
        FROM public.bundle_events be
        JOIN public.events e ON e.id = be.event_id
        WHERE be.bundle_id = p_bundle_id
    LOOP
        IF v_event.max_attendees IS NOT NULL AND v_event.rsvp_count >= v_event.max_attendees THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Cannot purchase bundle. Event ' || v_event.title || ' is sold out.'
            );
        END IF;
    END LOOP;

    -- Insert record into bundle_purchases
    INSERT INTO public.bundle_purchases (
        bundle_id,
        user_id,
        amount_paid,
        stripe_session_id,
        status,
        created_at
    ) VALUES (
        p_bundle_id,
        p_user_id,
        v_bundle.price_dollars,
        p_stripe_session_id,
        'COMPLETED',
        NOW()
    ) RETURNING id INTO v_purchase_id;

    -- Iteratively insert RSVPs for all bundled events
    FOR v_event IN
        SELECT event_id FROM public.bundle_events WHERE bundle_id = p_bundle_id
    LOOP
        INSERT INTO public.event_rsvps (event_id, user_id, status)
        VALUES (v_event.event_id, p_user_id, 'approved')
        ON CONFLICT (event_id, user_id) DO NOTHING;

        v_rsvps_created := v_rsvps_created + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'bundle_id', p_bundle_id,
        'rsvps_created_count', v_rsvps_created,
        'amount_paid', v_bundle.price_dollars
    );
END;
$$;
