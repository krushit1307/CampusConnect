-- Migration: 20261231000018_digital_business_card_vcf.sql
-- Description: Digital Business Card Exchange enhancements - Fetch contextual connections with profiles (#3597)

CREATE OR REPLACE FUNCTION public.get_user_business_card_connections(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connected_user_id UUID,
    connected_name TEXT,
    connected_handle TEXT,
    connected_email TEXT,
    connected_phone TEXT,
    connected_linkedin TEXT,
    connected_major TEXT,
    met_at_event_id UUID,
    met_at_event_title TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS connection_id,
        p.id AS connected_user_id,
        COALESCE(p.full_name, p.username, 'CampusConnect Member') AS connected_name,
        p.handle AS connected_handle,
        p.email AS connected_email,
        p.phone_number AS connected_phone,
        p.linkedin_url AS connected_linkedin,
        p.major AS connected_major,
        c.met_at_event_id,
        e.title AS met_at_event_title,
        c.created_at
    FROM public.user_connections c
    JOIN public.profiles p ON p.id = (
        CASE 
            WHEN c.user_id_1 = p_user_id THEN c.user_id_2 
            ELSE c.user_id_1 
        END
    )
    LEFT JOIN public.events e ON e.id = c.met_at_event_id
    WHERE c.user_id_1 = p_user_id OR c.user_id_2 = p_user_id
    ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_business_card_connections TO authenticated, anon;
