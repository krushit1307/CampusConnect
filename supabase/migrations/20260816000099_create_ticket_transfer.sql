-- 1. Create ticket_transfer_logs table for audit trail
CREATE TABLE IF NOT EXISTS ticket_transfer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours') NOT NULL
);

-- Index for fast transfer lookups
CREATE INDEX IF NOT EXISTS idx_transfer_logs_ticket ON ticket_transfer_logs(ticket_id);

-- 2. Atomic SQL transaction to transfer ticket
CREATE OR REPLACE FUNCTION transfer_ticket_transaction(
    p_ticket_id UUID,
    p_sender_id UUID,
    p_recipient_email TEXT,
    p_new_owner_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- Log the transfer attempt
    INSERT INTO ticket_transfer_logs (ticket_id, sender_id, recipient_email, status)
    VALUES (p_ticket_id, p_sender_id, p_recipient_email, 'PENDING')
    RETURNING id INTO v_log_id;

    -- If immediate recipient user ID is provided, finalize ownership update
    IF p_new_owner_id IS NOT NULL THEN
        UPDATE rsvps
        SET user_id = p_new_owner_id,
            updated_at = NOW()
        WHERE id = p_ticket_id AND user_id = p_sender_id;

        UPDATE ticket_transfer_logs
        SET status = 'ACCEPTED'
        WHERE id = v_log_id;
    END IF;

    RETURN jsonb_build_object(
        'transfer_log_id', v_log_id,
        'status', CASE WHEN p_new_owner_id IS NOT NULL THEN 'ACCEPTED' ELSE 'PENDING' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;