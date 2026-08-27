-- 1. Create meal_substitution_requests table
CREATE TABLE IF NOT EXISTS meal_substitution_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    restriction_type TEXT NOT NULL, -- e.g. 'vegan', 'gluten-free', 'halal', 'kosher'
    alternative_meal_name TEXT NOT NULL,
    price_premium NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'requested' NOT NULL CHECK (status IN ('requested', 'approved', 'fulfilled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Index for caterer manifest exports
CREATE INDEX IF NOT EXISTS idx_meal_substitutions_event ON meal_substitution_requests(event_id);

-- Enable RLS
ALTER TABLE meal_substitution_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view/create their own meal requests; organizers can manage all
CREATE POLICY "Users and organizers can access meal substitutions"
    ON meal_substitution_requests FOR ALL
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM event_organizers eo
            WHERE eo.event_id = meal_substitution_requests.event_id AND eo.user_id = auth.uid()
        )
    );

-- Stored RPC procedure to append meal requests and update event budget premium
CREATE OR REPLACE FUNCTION request_alternative_meal_substitution(
    p_event_id UUID,
    p_user_id UUID,
    p_rsvp_id UUID,
    p_restriction_type TEXT,
    p_alternative_meal_name TEXT,
    p_price_premium NUMERIC(10, 2) DEFAULT 0.00
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update special meal substitution request
    INSERT INTO meal_substitution_requests (
        event_id, user_id, rsvp_id, restriction_type, alternative_meal_name, price_premium
    ) VALUES (
        p_event_id, p_user_id, p_rsvp_id, p_restriction_type, p_alternative_meal_name, p_price_premium
    )
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET
        alternative_meal_name = p_alternative_meal_name,
        price_premium = p_price_premium,
        created_at = NOW();

    -- Adjust event total budget expenditure if premium applies
    IF p_price_premium > 0 THEN
        UPDATE events
        SET estimated_budget = COALESCE(estimated_budget, 0) + p_price_premium
        WHERE id = p_event_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;