-- =============================================================================
-- Migration: Interactive Food Menu with Allergen Filters
-- Issue: #3341 - Build an 'Interactive Food Menu with Allergen Filters'
-- Description: Creates event_menu_items so organizers can enter catering
-- dishes with structured allergen tags, instead of a flat text menu.
-- Attendees can then filter the menu by dietary need on the event page.
-- =============================================================================

-- ── Step 1: event_menu_items table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.event_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_vegan BOOLEAN NOT NULL DEFAULT FALSE,
    is_gluten_free BOOLEAN NOT NULL DEFAULT FALSE,
    contains_nuts BOOLEAN NOT NULL DEFAULT FALSE,
    contains_dairy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_menu_items_event_id ON public.event_menu_items(event_id);

-- ── Step 2: RLS ───────────────────────────────────────────────
ALTER TABLE public.event_menu_items ENABLE ROW LEVEL SECURITY;

-- Menus are public — attendees need to see them (and filter them) without
-- logging in, since this is a health/safety feature.
DROP POLICY IF EXISTS "Menu items are viewable by everyone." ON public.event_menu_items;
CREATE POLICY "Menu items are viewable by everyone."
ON public.event_menu_items FOR SELECT
USING (true);

-- Only the event's organizer (its club admin/creator) can add dishes.
DROP POLICY IF EXISTS "Event organizers can add menu items." ON public.event_menu_items;
CREATE POLICY "Event organizers can add menu items."
ON public.event_menu_items FOR INSERT
WITH CHECK (
    public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.events
        WHERE id = event_menu_items.event_id AND created_by = auth.uid()
    )
);

-- Only the event's organizer can edit or remove dishes.
DROP POLICY IF EXISTS "Event organizers can manage menu items." ON public.event_menu_items;
CREATE POLICY "Event organizers can manage menu items."
ON public.event_menu_items FOR UPDATE
USING (
    public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.events
        WHERE id = event_menu_items.event_id AND created_by = auth.uid()
    )
)
WITH CHECK (
    public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.events
        WHERE id = event_menu_items.event_id AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Event organizers can delete menu items." ON public.event_menu_items;
CREATE POLICY "Event organizers can delete menu items."
ON public.event_menu_items FOR DELETE
USING (
    public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_id), auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.events
        WHERE id = event_menu_items.event_id AND created_by = auth.uid()
    )
);

COMMENT ON TABLE public.event_menu_items IS
'Structured catering dishes with allergen tags for an event, so attendees can filter by dietary need. Issue #3341.';

-- =============================================================================
-- End of migration
-- =============================================================================