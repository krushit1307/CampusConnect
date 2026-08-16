-- Migration: 20261109000000_create_merch_inventory.sql
-- Description: Creates merch_items, merch_variants, and decrement/release stock functions

-- 1. Create merch_items
CREATE TABLE IF NOT EXISTS public.merch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create merch_variants
CREATE TABLE IF NOT EXISTS public.merch_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merch_item_id UUID NOT NULL REFERENCES public.merch_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0, -- Price in cents
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT merch_variant_stock_non_negative CHECK (stock >= 0),
    CONSTRAINT merch_variant_price_positive CHECK (price >= 0)
);

-- 3. Enable RLS
ALTER TABLE public.merch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_variants ENABLE ROW LEVEL SECURITY;

-- 4. Policies for merch_items
CREATE POLICY "Anyone can read merch_items"
    ON public.merch_items
    FOR SELECT
    USING (true);

CREATE POLICY "Club executives can insert merch_items"
    ON public.merch_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_items.club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'executive'
        )
    );

CREATE POLICY "Club executives can update merch_items"
    ON public.merch_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_items.club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'executive'
        )
    );

CREATE POLICY "Club executives can delete merch_items"
    ON public.merch_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = merch_items.club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'executive'
        )
    );

-- 5. Policies for merch_variants
CREATE POLICY "Anyone can read merch_variants"
    ON public.merch_variants
    FOR SELECT
    USING (true);

CREATE POLICY "Club executives can manage merch_variants"
    ON public.merch_variants
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.merch_items mi
            JOIN public.club_members cm ON cm.club_id = mi.club_id
            WHERE mi.id = merch_variants.merch_item_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'executive'
        )
    );

-- 6. RPC: decrement_merch_stock (Atomic subtraction)
CREATE OR REPLACE FUNCTION public.decrement_merch_stock(
    p_variant_id UUID,
    p_quantity INTEGER
)
RETURNS public.merch_variants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_variant public.merch_variants;
BEGIN
    IF p_quantity < 1 THEN
        RAISE EXCEPTION 'Invalid quantity';
    END IF;

    UPDATE public.merch_variants
    SET 
        stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_variant_id
      AND stock >= p_quantity
    RETURNING * INTO updated_variant;

    IF updated_variant.id IS NULL THEN
        RAISE EXCEPTION 'Out of stock';
    END IF;

    RETURN updated_variant;
END;
$$;

-- 7. RPC: release_merch_stock (Rollback logic)
CREATE OR REPLACE FUNCTION public.release_merch_stock(
    p_variant_id UUID,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_quantity < 1 THEN
        RETURN;
    END IF;

    UPDATE public.merch_variants
    SET 
        stock = stock + p_quantity,
        updated_at = NOW()
    WHERE id = p_variant_id;
END;
$$;
