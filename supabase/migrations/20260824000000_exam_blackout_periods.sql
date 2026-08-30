-- ============================================================
-- Migration: 20260824000000_exam_blackout_periods.sql
-- Description:
-- Adds a blackout_periods table and enforces that no social events
-- can be created during these periods unless it is an approved 
-- "Study Break" created by an admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exam_blackout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exam_blackout_periods ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Blackout periods are viewable by everyone." ON public.exam_blackout_periods;
CREATE POLICY "Blackout periods are viewable by everyone." 
ON public.exam_blackout_periods FOR SELECT USING (true);

-- Allow system admins to manage blackout periods (matching repo pattern)
DROP POLICY IF EXISTS "System admins can insert blackout periods." ON public.exam_blackout_periods;
CREATE POLICY "System admins can insert blackout periods."
ON public.exam_blackout_periods FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can update blackout periods." ON public.exam_blackout_periods;
CREATE POLICY "System admins can update blackout periods."
ON public.exam_blackout_periods FOR UPDATE TO authenticated USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "System admins can delete blackout periods." ON public.exam_blackout_periods;
CREATE POLICY "System admins can delete blackout periods."
ON public.exam_blackout_periods FOR DELETE TO authenticated USING (public.is_system_admin());

-- Trigger function to validate event creation/update against blackout periods
CREATE OR REPLACE FUNCTION public.validate_event_blackout_period()
RETURNS TRIGGER AS $$
DECLARE
    is_blackout BOOLEAN;
    is_sys_admin BOOLEAN;
    evt_category TEXT;
BEGIN
    -- 1. Use real event columns (event_date)
    IF NEW.event_date IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Verify event-type/category field before filtering
    SELECT name INTO evt_category FROM public.event_categories WHERE id = NEW.category_id;

    -- Check if event_date falls inside any blackout period
    SELECT EXISTS (
        SELECT 1 FROM public.exam_blackout_periods
        WHERE NEW.event_date BETWEEN start_time AND end_time
    ) INTO is_blackout;

    IF is_blackout THEN
        -- 3. Verify profiles.role and the actual admin role value ('system_admin')
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND role::TEXT = 'system_admin'
        ) INTO is_sys_admin;

        -- If it's an admin and it's an approved Study Break event, allow it
        IF is_sys_admin AND (NEW.title ILIKE '%Study Break%' OR evt_category ILIKE '%Study Break%') THEN
            RETURN NEW;
        END IF;

        -- Exact error message required by Issue #4666
        RAISE EXCEPTION 'Cannot create social events during exam blackout periods.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_event_blackout_period ON public.events;

CREATE TRIGGER trg_validate_event_blackout_period
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_blackout_period();
