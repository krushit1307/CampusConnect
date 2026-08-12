-- =============================================================================
-- Migration: Create Seating Charts Table
-- Issue: #2730 - Implement a Graphical 'Seating Chart' Builder for Gala Events
-- Description: Creates the seating_charts table to store the complex JSON 
-- serialization of the canvas state (table coordinates, chair assignments).
-- Includes optimistic locking via a version column to prevent real-time conflicts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.seating_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Hall',
    canvas_state JSONB NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure only one seating chart per event (can be expanded later if needed)
    UNIQUE(event_id)
);

-- Index for fast lookups by event
CREATE INDEX IF NOT EXISTS idx_seating_charts_event_id 
ON public.seating_charts(event_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.seating_charts ENABLE ROW LEVEL SECURITY;

-- Anyone with read access to the event can view the seating chart
CREATE POLICY "Anyone can view seating charts for public events"
ON public.seating_charts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = seating_charts.event_id
        AND (e.status = 'PUBLISHED' OR e.club_id IN (
            SELECT club_id FROM public.club_members 
            WHERE user_id = auth.uid() AND status = 'approved'
        ))
    )
);

-- Only club admins can insert/update/delete seating charts
CREATE POLICY "Club admins can manage seating charts"
ON public.seating_charts FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = seating_charts.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = seating_charts.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
);

-- =============================================================================
-- Optimistic Locking Trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_seating_chart_version()
RETURNS TRIGGER AS $$
BEGIN
    -- If updating, ensure the version matches what the client sent
    -- This prevents two admins from overwriting each other's work simultaneously
    IF TG_OP = 'UPDATE' THEN
        IF OLD.version != NEW.version THEN
            RAISE EXCEPTION 'Optimistic locking failure: Seating chart was modified by another user. Please refresh and try again.';
        END IF;
        -- Increment version on successful update
        NEW.version := OLD.version + 1;
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_seating_chart_version ON public.seating_charts;
CREATE TRIGGER trg_check_seating_chart_version
BEFORE UPDATE ON public.seating_charts
FOR EACH ROW EXECUTE FUNCTION public.check_seating_chart_version();
