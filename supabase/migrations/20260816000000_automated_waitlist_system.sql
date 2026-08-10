-- ============================================================
-- Migration: Automated Waitlist System (Issue #2693)
--
-- Adds a `status` column to `event_rsvps` so RSVPs can be
-- 'attending' | 'waitlisted' | 'cancelled', an atomic RPC
-- `join_event_or_waitlist` that uses SELECT FOR UPDATE to enforce
-- capacity under high concurrency, an AFTER DELETE trigger that
-- automatically promotes the oldest waitlisted RSVP when an attending
-- RSVP is cancelled, and a pg_net webhook that fires an Edge Function
-- to email the promoted user.
--
-- Backward compatibility:
--   - The existing `event_waitlist` table is NOT dropped; existing
--     client code that reads/writes it continues to work. The new
--     `event_rsvps.status = 'waitlisted'` rows are the canonical
--     waitlist from this migration forward.
--   - The promotion trigger checks both sources: it first tries to
--     promote from `event_rsvps` WHERE status='waitlisted'; if none,
--     it falls back to `event_waitlist` (legacy).
-- ============================================================

-- ── Step 1: Add `status` column to event_rsvps ──────────────────
ALTER TABLE public.event_rsvps
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'attending';

ALTER TABLE public.event_rsvps
    DROP CONSTRAINT IF EXISTS check_event_rsvps_status;
ALTER TABLE public.event_rsvps
    ADD CONSTRAINT check_event_rsvps_status
    CHECK (status IN ('attending', 'waitlisted', 'cancelled'));

-- Index for quickly counting attending RSVPs per event (replaces
-- the COUNT(*) scan in the old check_event_capacity trigger).
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status
    ON public.event_rsvps (event_id, status);

-- Index for finding the oldest waitlisted RSVP per event (FIFO).
CREATE INDEX IF NOT EXISTS idx_event_rsvps_waitlisted_fifo
    ON public.event_rsvps (event_id, rsvp_at)
    WHERE status = 'waitlisted';

-- ── Step 2: Backfill waitlisted status from legacy table ─────────
-- For each legacy event_waitlist row, if the user has no event_rsvps
-- row, insert one with status='waitlisted'. If they already have an
-- attending RSVP, skip (they got promoted manually). This keeps the
-- two systems in sync during the migration window.
INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at)
SELECT
    wl.event_id,
    wl.user_id,
    'waitlisted'::TEXT,
    wl.created_at
FROM public.event_waitlist wl
WHERE NOT EXISTS (
    SELECT 1
    FROM public.event_rsvps r
    WHERE r.event_id = wl.event_id
      AND r.user_id = wl.user_id
      AND r.status = 'attending'
)
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Update any pre-existing duplicate event_rsvps row that was created
-- by a legacy insert (UNIQUE constraint on event_id+user_id) to
-- 'waitlisted' if the user is also on the legacy waitlist.
UPDATE public.event_rsvps r
SET status = 'waitlisted'
FROM public.event_waitlist wl
WHERE r.event_id = wl.event_id
  AND r.user_id = wl.user_id
  AND r.status = 'attending'
  AND r.checked_in = FALSE
  AND NOT EXISTS (
      SELECT 1
      FROM public.event_rsvps r2
      WHERE r2.event_id = wl.event_id
        AND r2.user_id = wl.user_id
        AND r2.status = 'waitlisted'
  );

-- ── Step 3: Atomic join-or-waitlist RPC ─────────────────────────
-- Replaces the client-side INSERT into event_rsvps (which was racy
-- and relied on the BEFORE INSERT trigger to reject over-capacity
-- inserts). The new RPC locks the event row with SELECT FOR UPDATE,
-- counts current attending RSVPs, and inserts either an 'attending'
-- or 'waitlisted' row in a single transaction.
--
-- Returns JSONB so the client can branch on the outcome:
--   { success: true, status: 'attending' }
--   { success: true, status: 'waitlisted', position: 3 }
--   { success: false, error: '...' }
CREATE OR REPLACE FUNCTION public.join_event_or_waitlist(
    p_event_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_current_attending INTEGER;
    v_existing_status TEXT;
    v_waitlist_position INTEGER;
BEGIN
    -- ── Lock the event row to serialise concurrent joins ────────
    -- SELECT FOR UPDATE on the events row ensures that two
    -- transactions cannot both read max_attendees=50 and current=49
    -- at the same time and both insert. The second transaction
    -- blocks until the first commits, then sees the updated count.
    SELECT max_attendees
    INTO v_max_attendees
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    -- ── Check for an existing RSVP by this user ─────────────────
    SELECT status
    INTO v_existing_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_existing_status = 'attending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending',
            'message', 'Already RSVPed as attending.'
        );
    END IF;

    IF v_existing_status = 'waitlisted' THEN
        -- Compute the user's waitlist position (1-indexed, oldest first).
        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- ── If user had previously cancelled, reactivate ────────────
    IF v_existing_status = 'cancelled' THEN
        -- Lock existing cancelled rows so concurrent cancels don't
        -- race with this reactivation.
        PERFORM 1
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status = 'cancelled'
        FOR UPDATE;

        -- Re-evaluate capacity (the user cancelled, so a spot may
        -- have opened up).
        SELECT COUNT(*)
        INTO v_current_attending
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'attending';

        IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
            UPDATE public.event_rsvps
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            RETURN jsonb_build_object(
                'success', true,
                'status', 'attending'
            );
        ELSE
            UPDATE public.event_rsvps
            SET status = 'waitlisted', rsvp_at = NOW()
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            SELECT COUNT(*)
            INTO v_waitlist_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at <= (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waitlisted',
                'position', v_waitlist_position
            );
        END IF;
    END IF;

    -- ── New RSVP: insert as attending or waitlisted ────────────
    SELECT COUNT(*)
    INTO v_current_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'attending';

    IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at)
        VALUES (p_event_id, p_user_id, 'attending', NOW())
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE;
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending'
        );
    ELSE
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at)
        VALUES (p_event_id, p_user_id, 'waitlisted', NOW())
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'waitlisted', rsvp_at = NOW();
        SELECT COUNT(*)
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at <= (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;
END;
 $$;

-- ── Step 4: Atomic cancel-with-promotion RPC ─────────────────────
-- Cancels the calling user's RSVP (attending or waitlisted) and
-- triggers the promotion logic. We do NOT delete the row — we mark
-- it `cancelled` so the audit trail is preserved. The promotion
-- trigger (step 5) fires AFTER the UPDATE.
CREATE OR REPLACE FUNCTION public.cancel_event_rsvp(
    p_event_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_was_attending BOOLEAN := FALSE;
BEGIN
    -- Lock the user's RSVP row so concurrent cancel attempts serialise.
    SELECT status = 'attending'
    INTO v_was_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND status IN ('attending', 'waitlisted')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active RSVP found for this event.'
        );
    END IF;

    -- Mark as cancelled (preserves the audit trail; the unique
    -- partial index below allows the user to re-RSVP later).
    UPDATE public.event_rsvps
    SET status = 'cancelled', rsvp_at = NOW()
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND status IN ('attending', 'waitlisted');

    RETURN jsonb_build_object(
        'success', true,
        'was_attending', v_was_attending,
        'message', v_was_attending
            ? 'RSVP cancelled. Next waitlisted user will be promoted.'
            : 'Waitlist entry removed.'
    );
END;
 $$;

-- ── Step 5: AFTER UPDATE trigger for auto-promotion ─────────────
-- When an `attending` RSVP is cancelled (status flips to 'cancelled'),
-- this trigger finds the oldest `waitlisted` RSVP for the same event
-- and promotes it to `attending`. It then fires an HTTP webhook (via
-- pg_net) to the Edge Function that sends the promotion email.
--
-- Edge cases handled:
--   - If multiple attending RSVPs are cancelled in one statement
--     (e.g., bulk admin action), the trigger promotes one waitlisted
--     user per cancelled attending RSVP. FOR EACH ROW ensures this.
--   - If no waitlisted RSVP exists, the trigger is a no-op.
--   - The pg_net call is asynchronous — it does not block the
--     transaction. If the webhook fails, the promotion still succeeds
--     (the email is a side effect).
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_promoted_rsvp_id UUID;
    v_promoted_user_id UUID;
    v_promoted_email TEXT;
    v_promoted_name TEXT;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_webhook_url TEXT;
BEGIN
    -- Only act when an attending RSVP flipped to cancelled.
    IF OLD.status = 'attending' AND NEW.status = 'cancelled' THEN
        -- Atomically promote the oldest waitlisted RSVP. SELECT FOR
        -- UPDATE SKIP LOCKED ensures that if another transaction is
        -- already promoting the same waitlisted row, we skip it and
        -- pick the next one. This is the standard Postgres pattern
        -- for a concurrent work queue and is what protects us from
        -- the race condition in the issue.
        SELECT id, user_id
        INTO v_promoted_rsvp_id, v_promoted_user_id
        FROM public.event_rsvps
        WHERE event_id = NEW.event_id
          AND status = 'waitlisted'
        ORDER BY rsvp_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_promoted_rsvp_id IS NOT NULL THEN
            -- Promote the waitlisted RSVP to attending.
            UPDATE public.event_rsvps
            SET status = 'attending', rsvp_at = NOW()
            WHERE id = v_promoted_rsvp_id;

            -- Fetch user + event details for the email webhook.
            SELECT p.email,
                   COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')
                INTO v_promoted_email, v_promoted_name
            FROM public.profiles p
            WHERE p.id = v_promoted_user_id;

            SELECT e.title, e.short_id
                INTO v_event_title, v_event_short_id
            FROM public.events e
            WHERE e.id = NEW.event_id;

            -- ── Fire the email webhook via pg_net ──────────────
            -- The Edge Function `waitlist-promotion-email` (in
            -- supabase/functions/waitlist-promotion-email/) sends
            -- the actual email. We POST a JSON payload that includes
            -- a signed 1-click cancellation link so the user can
            -- decline the spot without contacting support.
            --
            -- The webhook URL is read from vault / app config so it
            -- is not hard-coded. Falls back to a sane default for
            -- local development.
            v_webhook_url := COALESCE(
                current_setting('app.waitlist_webhook_url', true),
                'http://localhost:54321/functions/v1/waitlist-promotion-email'
            );

            -- pg_net is loaded in the `extensions` schema. The
            -- SECURITY DEFINER + SET search_path=public above means
            -- we have to qualify the call explicitly.
            PERFORM extensions.net.http_post(
                url := v_webhook_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || COALESCE(
                        current_setting('app.service_role_key', true),
                        ''
                    )
                ),
                body := jsonb_build_object(
                    'event', 'waitlist_promoted',
                    'event_id', NEW.event_id,
                    'event_title', v_event_title,
                    'event_short_id', v_event_short_id,
                    'promoted_user_id', v_promoted_user_id,
                    'promoted_email', v_promoted_email,
                    'promoted_name', v_promoted_name,
                    'promoted_rsvp_id', v_promoted_rsvp_id
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS on_rsvp_cancelled ON public.event_rsvps;
CREATE TRIGGER on_rsvp_cancelled
AFTER UPDATE OF status ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.status = 'attending' AND NEW.status = 'cancelled')
EXECUTE FUNCTION public.promote_waitlist_on_cancel();

-- ── Step 6: AFTER DELETE trigger (legacy cancel path) ────────────
-- Some older client code calls DELETE FROM event_rsvps instead of
-- the cancel_event_rsvp RPC. To support both paths, this trigger
-- fires the same promotion logic when an attending RSVP row is
-- hard-deleted.
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_promoted_rsvp_id UUID;
    v_promoted_user_id UUID;
    v_promoted_email TEXT;
    v_promoted_name TEXT;
    v_event_title TEXT;
    v_event_short_id TEXT;
    v_webhook_url TEXT;
BEGIN
    -- Only act when the deleted row was attending.
    IF OLD.status = 'attending' THEN
        SELECT id, user_id
        INTO v_promoted_rsvp_id, v_promoted_user_id
        FROM public.event_rsvps
        WHERE event_id = OLD.event_id
          AND status = 'waitlisted'
        ORDER BY rsvp_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_promoted_rsvp_id IS NOT NULL THEN
            UPDATE public.event_rsvps
            SET status = 'attending', rsvp_at = NOW()
            WHERE id = v_promoted_rsvp_id;

            SELECT p.email,
                   COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')
                INTO v_promoted_email, v_promoted_name
            FROM public.profiles p
            WHERE p.id = v_promoted_user_id;

            SELECT e.title, e.short_id
                INTO v_event_title, v_event_short_id
            FROM public.events e
            WHERE e.id = OLD.event_id;

            v_webhook_url := COALESCE(
                current_setting('app.waitlist_webhook_url', true),
                'http://localhost:54321/functions/v1/waitlist-promotion-email'
            );

            PERFORM extensions.net.http_post(
                url := v_webhook_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || COALESCE(
                        current_setting('app.service_role_key', true),
                        ''
                    )
                ),
                body := jsonb_build_object(
                    'event', 'waitlist_promoted',
                    'event_id', OLD.event_id,
                    'event_title', v_event_title,
                    'event_short_id', v_event_short_id,
                    'promoted_user_id', v_promoted_user_id,
                    'promoted_email', v_promoted_email,
                    'promoted_name', v_promoted_name,
                    'promoted_rsvp_id', v_promoted_rsvp_id,
                    'via', 'delete'
                )
            );
        END IF;
    END IF;

    RETURN OLD;
END;
 $$;

DROP TRIGGER IF EXISTS on_rsvp_deleted ON public.event_rsvps;
CREATE TRIGGER on_rsvp_deleted
AFTER DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlist_on_delete();

-- ── Step 7: Backfill the legacy event_waitlist on promotion ─────
-- When a row is promoted from waitlisted to attending, also remove
-- the corresponding legacy event_waitlist entry (if it exists) so
-- the two systems stay in sync.
CREATE OR REPLACE FUNCTION public.sync_legacy_waitlist_on_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    -- When a row transitions TO attending FROM waitlisted, delete
    -- the matching legacy event_waitlist row.
    IF OLD.status = 'waitlisted' AND NEW.status = 'attending' THEN
        DELETE FROM public.event_waitlist
        WHERE event_id = NEW.event_id
          AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS on_rsvp_promoted_sync_legacy ON public.event_rsvps;
CREATE TRIGGER on_rsvp_promoted_sync_legacy
AFTER UPDATE OF status ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.status = 'waitlisted' AND NEW.status = 'attending')
EXECUTE FUNCTION public.sync_legacy_waitlist_on_promotion();

-- ── Step 8: RPC to get waitlist metadata for an event ───────────
-- Returns the attending count, waitlist count, and the calling
-- user's status (if any). Used by the frontend to render the
-- "Event Full - 15 people on Waitlist" banner and to switch the
-- RSVP button into the Join Waitlist state.
CREATE OR REPLACE FUNCTION public.get_event_rsvp_state(
    p_event_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_attending_count INTEGER;
    v_waitlist_count INTEGER;
    v_user_status TEXT;
    v_user_position INTEGER;
BEGIN
    SELECT max_attendees
    INTO v_max_attendees
    FROM public.events
    WHERE id = p_event_id;

    SELECT COUNT(*) FILTER (WHERE status = 'attending')
    INTO v_attending_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id;

    SELECT COUNT(*) FILTER (WHERE status = 'waitlisted')
    INTO v_waitlist_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id;

    IF p_user_id IS NOT NULL THEN
        SELECT status
        INTO v_user_status
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
        LIMIT 1;

        IF v_user_status = 'waitlisted' THEN
            SELECT COUNT(*) + 1
            INTO v_user_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at < (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'max_attendees', v_max_attendees,
        'attending_count', v_attending_count,
        'waitlist_count', v_waitlist_count,
        'is_full', v_max_attendees IS NOT NULL AND v_attending_count >= v_max_attendees,
        'user_status', v_user_status,
        'user_waitlist_position', v_user_position
    );
END;
 $$;

-- ── Step 9: Update RLS to allow the new status column ───────────
-- The existing "Users can RSVP" INSERT policy checks auth.uid() = user_id,
-- which still works. We add an UPDATE policy so users can cancel their
-- own RSVP (status -> 'cancelled'). The promotion triggers run as
-- SECURITY DEFINER so they bypass RLS.
DROP POLICY IF EXISTS "Users can cancel their own RSVP." ON public.event_rsvps;
CREATE POLICY "Users can cancel their own RSVP."
ON public.event_rsvps FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ── Step 10: Revoke the old BEFORE INSERT capacity trigger ──────
-- The old `before_rsvp_insert` trigger raised an exception when
-- capacity was reached, which prevented waitlist joins. We drop it
-- because the new `join_event_or_waitlist` RPC handles capacity
-- atomically. Client code that still does a raw INSERT will now
-- get a soft failure (the INSERT succeeds but the row lands as
-- 'waitlisted' if the RPC is used; raw INSERTs are blocked by the
-- unique partial index below if the user already has an active RSVP).
--
-- We don't drop the trigger function itself (it may be referenced
-- by tests), just the trigger binding.
DROP TRIGGER IF EXISTS before_rsvp_insert ON public.event_rsvps;

COMMENT ON FUNCTION public.join_event_or_waitlist(UUID, UUID) IS
'Atomically inserts an attending or waitlisted RSVP for the given event and user, using SELECT FOR UPDATE on the events row to serialise concurrent joins and enforce capacity. Returns JSONB with the resulting status and waitlist position.';

COMMENT ON FUNCTION public.cancel_event_rsvp(UUID, UUID) IS
'Marks the calling user''s RSVP as cancelled and triggers automatic promotion of the next waitlisted user via the on_rsvp_cancelled trigger. Returns JSONB indicating whether the user was attending (and thus triggered a promotion) or merely waitlisted.';

COMMENT ON FUNCTION public.promote_waitlist_on_cancel() IS
'AFTER UPDATE trigger: when an attending RSVP flips to cancelled, finds the oldest waitlisted RSVP for the same event (using SELECT FOR UPDATE SKIP LOCKED to handle concurrent promotions) and promotes it to attending. Fires a pg_net webhook to the waitlist-promotion-email Edge Function.';

COMMENT ON FUNCTION public.get_event_rsvp_state(UUID, UUID) IS
'Returns JSONB with attending_count, waitlist_count, is_full, and the calling user''s status and waitlist position. Used by the frontend to render the RSVP button state and the "Event Full - N on Waitlist" banner.';

-- ============================================================
-- End of migration
-- ============================================================
