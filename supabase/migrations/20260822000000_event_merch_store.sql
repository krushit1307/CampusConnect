-- =============================================================================
-- Issue #3924: Dynamic Event Merch Store Module
-- SQL Migration: Create event_merch_items, event_merch_variants,
--                event_merch_orders, event_merch_order_items tables
-- =============================================================================

-- 1. Event Merch Items (linked to events, not clubs)
CREATE TABLE IF NOT EXISTS public.event_merch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_merch_items_event_id
    ON public.event_merch_items(event_id);

-- 2. Event Merch Variants (size + stock per item)
CREATE TABLE IF NOT EXISTS public.event_merch_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.event_merch_items(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(item_id, size)
);

CREATE INDEX IF NOT EXISTS idx_event_merch_variants_item_id
    ON public.event_merch_variants(item_id);

-- 3. Event Merch Orders (one per checkout session)
CREATE TABLE IF NOT EXISTS public.event_merch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'captured', 'failed')),
    fulfillment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (fulfillment_status IN ('pending', 'fulfilled', 'cancelled')),
    pickup_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_merch_orders_event_id
    ON public.event_merch_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_merch_orders_user_id
    ON public.event_merch_orders(user_id);

-- 4. Event Merch Order Items (line items within an order)
CREATE TABLE IF NOT EXISTS public.event_merch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.event_merch_orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.event_merch_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_merch_order_items_order_id
    ON public.event_merch_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_event_merch_order_items_variant_id
    ON public.event_merch_order_items(variant_id);

-- 5. Atomic stock decrement function (prevents overselling)
CREATE OR REPLACE FUNCTION public.decrement_merch_stock(
    p_variant_id UUID,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$ DECLARE
    new_stock INTEGER;
BEGIN
    UPDATE public.event_merch_variants
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at = now()
    WHERE id = p_variant_id
      AND stock_quantity >= p_quantity
    RETURNING stock_quantity INTO new_stock;

    IF new_stock IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
 $$ LANGUAGE plpgsql;

-- 6. Enable RLS
ALTER TABLE public.event_merch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_merch_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_merch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_merch_order_items ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

CREATE POLICY "event_merch_items_read" ON public.event_merch_items
    FOR SELECT USING (true);

CREATE POLICY "event_merch_items_write" ON public.event_merch_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_merch_items.event_id
            AND e.club_id IN (
                SELECT id FROM public.clubs
                WHERE creator_id = auth.uid()
                   OR id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer'))
            )
        )
    );

CREATE POLICY "event_merch_variants_read" ON public.event_merch_variants
    FOR SELECT USING (true);

CREATE POLICY "event_merch_variants_write" ON public.event_merch_variants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.event_merch_items imi
            JOIN public.events e ON e.id = imi.event_id
            WHERE imi.id = event_merch_variants.item_id
            AND e.club_id IN (
                SELECT id FROM public.clubs
                WHERE creator_id = auth.uid()
                   OR id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer'))
            )
        )
    );

CREATE POLICY "event_merch_orders_read_own" ON public.event_merch_orders
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "event_merch_orders_read_organizer" ON public.event_merch_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_merch_orders.event_id
            AND e.club_id IN (
                SELECT id FROM public.clubs
                WHERE creator_id = auth.uid()
                   OR id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer'))
            )
        )
    );

CREATE POLICY "event_merch_orders_insert_own" ON public.event_merch_orders
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_merch_orders_update_own" ON public.event_merch_orders
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "event_merch_orders_update_organizer" ON public.event_merch_orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_merch_orders.event_id
            AND e.club_id IN (
                SELECT id FROM public.clubs
                WHERE creator_id = auth.uid()
                   OR id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer'))
            )
        )
    );

CREATE POLICY "event_merch_order_items_read" ON public.event_merch_order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.event_merch_orders o
            WHERE o.id = event_merch_order_items.order_id
            AND (o.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.id = o.event_id
                AND e.club_id IN (
                    SELECT id FROM public.clubs
                    WHERE creator_id = auth.uid()
                       OR id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer'))
                )
            ))
        )
    );

CREATE POLICY "event_merch_order_items_insert" ON public.event_merch_order_items
    FOR INSERT WITH CHECK (true);
