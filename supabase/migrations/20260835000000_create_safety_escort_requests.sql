-- Create safety_escort_requests table
CREATE TABLE IF NOT EXISTS safety_escort_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    destination TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    status TEXT DEFAULT 'DISPATCHED' NOT NULL CHECK (status IN ('REQUESTED', 'DISPATCHED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
    eta_minutes INTEGER DEFAULT 5 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active security dispatch queries
CREATE INDEX IF NOT EXISTS idx_safety_escort_user ON safety_escort_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_escort_status ON safety_escort_requests(status);

-- Enable RLS
ALTER TABLE safety_escort_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own safety escort requests"
    ON safety_escort_requests FOR ALL
    USING (auth.uid() = user_id);