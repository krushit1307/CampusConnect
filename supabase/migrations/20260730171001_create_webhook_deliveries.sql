-- Create webhook_deliveries table
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'permanent_failure')),
    status_code INTEGER,
    attempt INTEGER NOT NULL DEFAULT 1,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at) WHERE status IN ('pending', 'failed');

-- Setup RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Admins can view deliveries for their club's webhooks
CREATE POLICY "Admins can view webhook deliveries" ON webhook_deliveries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM webhooks
            JOIN club_members ON club_members.club_id = webhooks.club_id
            WHERE webhooks.id = webhook_deliveries.webhook_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner')
        )
    );
