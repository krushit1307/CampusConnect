-- Migration: Crowd Sourced Campus Menu Integration & Informal Dining Meetups
-- Addresses Issue #3933

CREATE TABLE IF NOT EXISTS public.dining_halls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    campus_zone VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    capacity INT DEFAULT 500,
    open_time VARCHAR(20) DEFAULT '07:00',
    close_time VARCHAR(20) DEFAULT '22:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dining_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dining_hall_id UUID NOT NULL REFERENCES public.dining_halls(id) ON DELETE CASCADE,
    menu_date DATE NOT NULL,
    meal_period VARCHAR(50) NOT NULL CHECK (meal_period IN ('breakfast', 'lunch', 'dinner', 'late_night')),
    source_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    is_cached BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dining_hall_id, menu_date, meal_period)
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dining_menu_id UUID NOT NULL REFERENCES public.dining_menus(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    station_name VARCHAR(100) DEFAULT 'Main Entree',
    category VARCHAR(100) DEFAULT 'Entree',
    calories INT DEFAULT 0,
    protein_g NUMERIC(5,1) DEFAULT 0,
    carbs_g NUMERIC(5,1) DEFAULT 0,
    fat_g NUMERIC(5,1) DEFAULT 0,
    allergens TEXT[] DEFAULT '{}',
    dietary_flags TEXT[] DEFAULT '{}',
    upvotes_count INT DEFAULT 0,
    downvotes_count INT DEFAULT 0,
    crowd_rating NUMERIC(3,2) DEFAULT 0.00,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_item_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('UP', 'DOWN')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.informal_dining_meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    dining_hall_id UUID NOT NULL REFERENCES public.dining_halls(id) ON DELETE CASCADE,
    host_user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    meetup_time TIMESTAMPTZ NOT NULL,
    max_participants INT DEFAULT 8,
    table_location VARCHAR(255) DEFAULT 'Main Dining Commons Area',
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.informal_meetup_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id UUID NOT NULL REFERENCES public.informal_dining_meetups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rsvp_status VARCHAR(20) DEFAULT 'CONFIRMED' CHECK (rsvp_status IN ('CONFIRMED', 'WAITLIST', 'CANCELLED')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meetup_id, user_id)
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_dining_menus_lookup ON public.dining_menus(dining_hall_id, menu_date, meal_period);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON public.menu_items(dining_menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_crowd_rating ON public.menu_items(crowd_rating DESC);
CREATE INDEX IF NOT EXISTS idx_meetups_hall_time ON public.informal_dining_meetups(dining_hall_id, meetup_time);
CREATE INDEX IF NOT EXISTS idx_meetups_item_id ON public.informal_dining_meetups(menu_item_id);

-- Enable RLS
ALTER TABLE public.dining_halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informal_dining_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informal_meetup_attendees ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
CREATE POLICY "Public read for dining halls" ON public.dining_halls FOR SELECT USING (true);
CREATE POLICY "Public read for dining menus" ON public.dining_menus FOR SELECT USING (true);
CREATE POLICY "Public read for menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Public read for meetup listings" ON public.informal_dining_meetups FOR SELECT USING (true);
CREATE POLICY "Public read for meetup attendees" ON public.informal_meetup_attendees FOR SELECT USING (true);
CREATE POLICY "Public read for item votes" ON public.menu_item_votes FOR SELECT USING (true);

-- Authenticated write policies
CREATE POLICY "Auth users can insert/update item votes" ON public.menu_item_votes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can create informal meetups" ON public.informal_dining_meetups
    FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their informal meetups" ON public.informal_dining_meetups
    FOR UPDATE USING (auth.uid() = host_user_id);

CREATE POLICY "Users can manage their meetup RSVPs" ON public.informal_meetup_attendees
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Function to recalculate crowd rating and vote counts
CREATE OR REPLACE FUNCTION public.sync_menu_item_votes()
RETURNS TRIGGER AS $$
DECLARE
    v_item_id UUID;
    v_up INT;
    v_down INT;
    v_score NUMERIC(3,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_item_id := OLD.menu_item_id;
    ELSE
        v_item_id := NEW.menu_item_id;
    END IF;

    SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'UP'),
        COUNT(*) FILTER (WHERE vote_type = 'DOWN')
    INTO v_up, v_down
    FROM public.menu_item_votes
    WHERE menu_item_id = v_item_id;

    IF (v_up + v_down) > 0 THEN
        v_score := ROUND((v_up::NUMERIC / (v_up + v_down)::NUMERIC) * 5.0, 2);
    ELSE
        v_score := 0.00;
    END IF;

    UPDATE public.menu_items
    SET 
        upvotes_count = v_up,
        downvotes_count = v_down,
        crowd_rating = v_score
    WHERE id = v_item_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_menu_item_votes ON public.menu_item_votes;
CREATE TRIGGER trg_sync_menu_item_votes
AFTER INSERT OR UPDATE OR DELETE ON public.menu_item_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_menu_item_votes();
