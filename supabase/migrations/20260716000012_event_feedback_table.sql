-- ============================================================
-- Migration: 20260716000012_event_feedback_table.sql
-- Description:
-- Adds attendee event feedback support with automatic average
-- rating calculation on the events table.
-- ============================================================

-- ------------------------------------------------------------
-- Add cached average_rating column
-- ------------------------------------------------------------

ALTER TABLE events
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN events.average_rating IS
'Stores the cached average rating for an event.';

-- ------------------------------------------------------------
-- Create event_feedbacks table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL
        REFERENCES events(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES profiles(id)
        ON DELETE CASCADE,

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (event_id, user_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_event_feedbacks_event_id
ON event_feedbacks(event_id);

CREATE INDEX IF NOT EXISTS idx_event_feedbacks_user_id
ON event_feedbacks(user_id);

-- ------------------------------------------------------------
-- Enable Row Level Security
-- ------------------------------------------------------------

ALTER TABLE event_feedbacks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read event feedback."
ON event_feedbacks;

DROP POLICY IF EXISTS "Users can read event feedback." ON event_feedbacks;
CREATE POLICY "Users can read event feedback."
ON event_feedbacks
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Checked-in users can leave feedback."
ON event_feedbacks;

DROP POLICY IF EXISTS "Checked-in users can leave feedback." ON event_feedbacks;
CREATE POLICY "Checked-in users can leave feedback."
ON event_feedbacks
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM event_rsvps
        WHERE event_rsvps.event_id = event_feedbacks.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

DROP POLICY IF EXISTS "Users can update own feedback."
ON event_feedbacks;

DROP POLICY IF EXISTS "Users can update own feedback." ON event_feedbacks;
CREATE POLICY "Users can update own feedback."
ON event_feedbacks
FOR UPDATE
USING (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM event_rsvps
        WHERE event_rsvps.event_id = event_feedbacks.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
)
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM event_rsvps
        WHERE event_rsvps.event_id = event_feedbacks.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

DROP POLICY IF EXISTS "Users can delete own feedback."
ON event_feedbacks;

DROP POLICY IF EXISTS "Users can delete own feedback." ON event_feedbacks;
CREATE POLICY "Users can delete own feedback."
ON event_feedbacks
FOR DELETE
USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Trigger Functions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_feedback_event_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.event_id <> OLD.event_id THEN
        RAISE EXCEPTION 'event_id cannot be changed after insertion.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_event_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_event UUID;
BEGIN
    target_event := COALESCE(NEW.event_id, OLD.event_id);

    UPDATE events
    SET average_rating = COALESCE(
        (
            SELECT ROUND(AVG(rating)::NUMERIC, 2)
            FROM event_feedbacks
            WHERE event_id = target_event
        ),
        0
    )
    WHERE id = target_event;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS ensure_feedback_event_immutable
ON event_feedbacks;

CREATE TRIGGER ensure_feedback_event_immutable
BEFORE UPDATE
ON event_feedbacks
FOR EACH ROW
EXECUTE FUNCTION prevent_feedback_event_id_change();

DROP TRIGGER IF EXISTS on_event_feedback_changed
ON event_feedbacks;

CREATE TRIGGER on_event_feedback_changed
AFTER INSERT OR UPDATE OR DELETE
ON event_feedbacks
FOR EACH ROW
EXECUTE FUNCTION update_event_average_rating();

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------