-- Postgres function to aggregate all user data into a JSON object for GDPR compliance
CREATE OR REPLACE FUNCTION export_user_data_json(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.id = p_user_id),
        'rsvps', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM rsvps r WHERE r.user_id = p_user_id),
        'created_events', (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM events e WHERE e.organizer_id = p_user_id),
        'exported_at', NOW()
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;