-- Migration: 20270119000000_merch_orders
-- Description: Add order header/items model for multi-item merch carts and checkout.

-- 1. Create merch_orders table — order header
CREATE TABLE IF NOT EXISTS public.merch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'captured', 'failed')),
    fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'picked_up', 'cancelled')),
    total_amount INTEGER NOT NULL DEFAULT 0, -- total in cents
    stripe_checkout_session_id TEXT,
    stripe_payment_intent_id TEXT,
    pickup_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create merch_order_items table — line items within an order
CREATE TABLE IF NOT EXISTS public.merch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.merch_orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.merch_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CONSTraint order_item_quantity_positive CHECK (quantity > 0),
    unit_price INTEGER NOT NULL DEFAULT 0, -- price in cents at time of purchase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT order_items_unique_variant_per_order UNIQUE (order_id, variant_id)
);

-- 3. Enable RLS
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_order_items ENABLE ROW LEVEL SECURITY;

-- 4. Policies for merch_orders
CREATE POLICY "Users can view own orders."
    ON public.merch_orders
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Club treasurers/admins can view orders for their club."
    ON public.merch_orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_orders.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    );

CREATE POLICY "System admins can view all orders."
    ON public.merch_orders
    FOR SELECT TO authenticated
    USING (public.is_system_admin());

CREATE POLICY "Users can insert own orders."
    ON public.merch_orders
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICy "Club treasurers/admins can update orders."
    ON public.merch_orders
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_orders.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_orders.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    );

-- 5. Policies for merch_order_items
CREATE POLICY "Users can view items in own orders."
    ON public.merch_order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.merch_orders o
        WHERE o.id = merch_order_items.order_id
          AND o.user_id = auth.uid()
    ));

CREATE POLICY "Club treasurers/admins can view order items for their club."
    ON public.merch_order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merch_orders o
            JOIN public.club_members cm ON cm.club_id = o.club_id
            WHERE o.id = merch_order_items.order_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    );

CREATE POLICY "System admins can view all order items."
    ON public.merch_order_items
    FOR SELECT TO authenticated
    USING (public.is_system_admin());

CREATE POLICY "Users can insert items in own orders."
    ON public.merch_order_items
    FOR INSERT TO authenticated
    WITH EXISTS (
        SELECT 1 FROM public.merch_orders o
        WHERE o.id = merch_order_items.order_id
          AND o.user_id = auth.uid()
    );

CREATE POLICY "Club treasurers/admins can update order items."
    ON public.merch_order_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.merch_orders o
            JOIN public.club_members cm ON cm.club_id = o.club_id
            WHERE o.id = merch_order_items.order_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merch_orders o
            JOIN public.club_members cm ON cm.club_id = o.club_id
            WHERE o.id = merch_order_items.order_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'admin', 'president', 'vice_president', 'secretary')
        )
    );

-- 6. Trigger to auto-update updated_at on merch_orders
CREATE OR REPLACE FUNCTION public.update_merch_orders_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_merch_orders
BEFORE UPDATE ON public.merch_orders
FOR EACH ROW EXECUTE FUNCTION public.update_merch_orders_updated_at();

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_merch_orders_user_id ON public.merch_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_club_id ON public.merch_orders(club_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_payment_status ON public.merch_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_merch_orders_fulfillment_status ON public.merch_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_merch_order_items_order_id ON public.merch_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_merch_order_items_variant_id ON public.merch_order_items(variant_id);