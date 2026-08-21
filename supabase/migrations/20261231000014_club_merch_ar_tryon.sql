-- Migration: 20261231000014_club_merch_ar_tryon.sql
-- Club Merch "Try-On" AR Filter (#3593)

-- 1. Create table for club merchandise items with AR overlay assets
CREATE TABLE IF NOT EXISTS public.club_merchandise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('tshirt', 'hoodie', 'crewneck', 'cap', 'tote_bag', 'jacket', 'other')) DEFAULT 'hoodie',
    price_cents INT NOT NULL DEFAULT 4500,
    transparent_logo_url TEXT NOT NULL,
    mockup_image_url TEXT,
    ar_scale_factor NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    ar_offset_y_percent NUMERIC(4,2) NOT NULL DEFAULT 0.00, -- Chest positioning offset
    is_preorder_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_club_merchandise_club ON public.club_merchandise(club_id);

-- 2. Create table for user AR snapshots & pre-order intent shares
CREATE TABLE IF NOT EXISTS public.merch_ar_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merch_id UUID NOT NULL REFERENCES public.club_merchandise(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    snapshot_url TEXT,
    shared_to TEXT, -- 'discord', 'instagram', 'twitter', 'direct'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.club_merchandise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_ar_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club merchandise"
    ON public.club_merchandise
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Club leaders can manage merchandise"
    ON public.club_merchandise
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = club_merchandise.club_id
              AND club_members.user_id = auth.uid()
              AND club_members.role IN ('president', 'officer', 'admin', 'leader')
        )
    );

CREATE POLICY "Anyone can insert snapshots"
    ON public.merch_ar_snapshots
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);
