-- ============================================================
-- Migration: 20260721120000_update_event_waitlist_schema_and_rls.sql
-- Issue: #586
-- Description:
--   - Adds `joined_at` column (with generated stored column or alias strategy)
--     preserving backward compatibility with `created_at` without breaking existing references.
--   - Replaces overly permissive SELECT policy ("Waitlists are viewable by everyone.")
--     with restrictive policies:
--       1) Users can read their own waitlist entries.
--       2) Club admins (and club creators) can read waitlist entries for their events.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Schema update: add `joined_at` with backward compatibility
-- ------------------------------------------------------------
-- Reason for strategy:
-- The existing table `public.event_waitlist` (created in 20260718000027_event_waitlist_schema.sql)
-- uses `created_at TIMESTAMPTZ DEFAULT NOW()`. Downstream functions (e.g. `promote_waitlist_attendee()`
-- in migration 20260719000003_waitlist_promotion.sql) depend on `created_at`.
-- To fulfill Issue #586 requirements without breaking existing code or performing a destructive schema change:
-- We add `joined_at` as a column defaulting to `NOW()`, backfilling existing rows from `created_at`.
-- We also sync newly inserted/updated rows using a trigger, or set default NOW().
-- Adding `joined_at` as a TIMESTAMPTZ column defaulting to NOW() preserves `created_at` completely.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_waitlist'
          AND column_name = 'joined_at'
    ) THEN
        ALTER TABLE public.event_waitlist
        ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW();

        -- Backfill joined_at with existing created_at values if created_at exists
        UPDATE public.event_waitlist
        SET joined_at = created_at
        WHERE joined_at IS NULL AND created_at IS NOT NULL;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 2. RLS Policy updates for `public.event_waitlist`
-- ------------------------------------------------------------

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Waitlists are viewable by everyone." ON public.event_waitlist;
DROP POLICY IF EXISTS "Users can read their own waitlist entries." ON public.event_waitlist;
DROP POLICY IF EXISTS "Club admins can read event waitlist entries." ON public.event_waitlist;

-- Users can read only their own waitlist entries
CREATE POLICY "Users can read their own waitlist entries."
ON public.event_waitlist
FOR SELECT
USING (auth.uid() = user_id);

-- Club admins (and club creators) can read all waitlist entries for their events
CREATE POLICY "Club admins can read event waitlist entries."
ON public.event_waitlist
FOR SELECT
USING (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = event_waitlist.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = event_waitlist.event_id)
          AND created_by = auth.uid()
    )
);
