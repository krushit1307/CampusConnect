-- Migration for Dynamic "Resource Constraint" Auction Fractional Ownership (#4915)

CREATE TABLE IF NOT EXISTS public.resource_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    auction_date DATE NOT NULL,
    base_points INT NOT NULL DEFAULT 1000,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auction_syndicate_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.resource_auctions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_points INT DEFAULT 0,
    is_open BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.syndicate_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES public.auction_syndicate_pools(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    points_contributed INT NOT NULL CHECK (points_contributed > 0),
    time_split_start TIME NOT NULL,
    time_split_end TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT time_split_check CHECK (time_split_start < time_split_end)
);

-- RLS
ALTER TABLE public.resource_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_syndicate_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syndicate_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view resource_auctions" ON public.resource_auctions FOR SELECT USING (true);
CREATE POLICY "Anyone can view auction_syndicate_pools" ON public.auction_syndicate_pools FOR SELECT USING (true);
CREATE POLICY "Anyone can view syndicate_members" ON public.syndicate_members FOR SELECT USING (true);

-- Allow authenticated to insert members (join syndicate)
CREATE POLICY "Auth users can join syndicates" ON public.syndicate_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
