-- 1. Ensure rsvps table supports offline sync tracking fields
ALTER TABLE rsvps
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkin_device_id TEXT,
ADD COLUMN IF NOT EXISTS offline_synced_at TIMESTAMPTZ;

-- 2. Create RPC for batch processing offline queued check-ins securely
CREATE OR REPLACE FUNCTION batch_sync_offline_checkins(
    p_checkins JSONB
)
RETURNS TABLE (
    rsvp_id UUID,
    status TEXT,
    message TEXT
) AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM jsonb_to_recordset(p_checkins) AS x(
        rsvp_id UUID,
        checked_in_at TIMESTAMPTZ,
        device_id TEXT
    )
    LOOP
        UPDATE rsvps
        SET 
            status = 'attended',
            checked_in_at = COALESCE(rsvps.checked_in_at, r.checked_in_at),
            checkin_device_id = r.device_id,
            offline_synced_at = NOW()
        WHERE id = r.rsvp_id;

        IF FOUND THEN
            rsvp_id := r.rsvp_id;
            status := 'SUCCESS';
            message := 'Offline check-in synced successfully';
            RETURN NEXT;
        ELSE
            rsvp_id := r.rsvp_id;
            status := 'FAILED';
            message := 'RSVP record not found';
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;