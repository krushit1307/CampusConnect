-- Create webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events_subscribed TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_webhooks_club_id ON webhooks(club_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events_subscribed ON webhooks USING GIN (events_subscribed);

-- Setup RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Admins can view webhooks for their clubs
CREATE POLICY "Admins can view webhooks for their clubs" ON webhooks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM club_members
            WHERE club_members.club_id = webhooks.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner')
        )
    );

-- Admins can insert webhooks for their clubs
CREATE POLICY "Admins can insert webhooks for their clubs" ON webhooks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM club_members
            WHERE club_members.club_id = webhooks.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner')
        )
    );

-- Admins can update webhooks for their clubs
CREATE POLICY "Admins can update webhooks for their clubs" ON webhooks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM club_members
            WHERE club_members.club_id = webhooks.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner')
        )
    );

-- Admins can delete webhooks for their clubs
CREATE POLICY "Admins can delete webhooks for their clubs" ON webhooks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM club_members
            WHERE club_members.club_id = webhooks.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner')
        )
    );
