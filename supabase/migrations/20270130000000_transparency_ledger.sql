-- 1. Create the club_settings table
CREATE TABLE IF NOT EXISTS public.club_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
    is_ledger_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the RPC for the public ledger
CREATE OR REPLACE FUNCTION public.get_public_club_ledger(p_club_id UUID)
RETURNS TABLE (
    category VARCHAR,
    total_amount NUMERIC
) AS $$
DECLARE
    v_is_public BOOLEAN;
BEGIN
    -- Check if the ledger is public
    SELECT is_ledger_public INTO v_is_public
    FROM public.club_settings
    WHERE club_id = p_club_id;

    -- If not public or setting doesn't exist, return empty
    IF v_is_public IS DISTINCT FROM true THEN
        RETURN;
    END IF;

    -- Aggregate expenses into categories, stripping sensitive descriptions
    RETURN QUERY
    SELECT 
        CASE 
            WHEN description ILIKE '%pizza%' OR description ILIKE '%food%' OR description ILIKE '%catering%' OR description ILIKE '%snack%' THEN 'Event Food'::VARCHAR
            WHEN description ILIKE '%venue%' OR description ILIKE '%room%' OR description ILIKE '%rental%' THEN 'Venue Rentals'::VARCHAR
            WHEN description ILIKE '%poster%' OR description ILIKE '%marketing%' OR description ILIKE '%ad %' OR description ILIKE '%flyer%' THEN 'Marketing'::VARCHAR
            WHEN description ILIKE '%speaker%' OR description ILIKE '%guest%' OR description ILIKE '%honorarium%' THEN 'Guest Speakers'::VARCHAR
            WHEN description ILIKE '%software%' OR description ILIKE '%subscription%' OR description ILIKE '%domain%' THEN 'Software & Subscriptions'::VARCHAR
            ELSE 'Other Operations'::VARCHAR
        END AS category,
        SUM(e.total_amount) AS total_amount
    FROM public.event_expenses e
    WHERE e.payer_club_id = p_club_id
    GROUP BY 
        CASE 
            WHEN description ILIKE '%pizza%' OR description ILIKE '%food%' OR description ILIKE '%catering%' OR description ILIKE '%snack%' THEN 'Event Food'::VARCHAR
            WHEN description ILIKE '%venue%' OR description ILIKE '%room%' OR description ILIKE '%rental%' THEN 'Venue Rentals'::VARCHAR
            WHEN description ILIKE '%poster%' OR description ILIKE '%marketing%' OR description ILIKE '%ad %' OR description ILIKE '%flyer%' THEN 'Marketing'::VARCHAR
            WHEN description ILIKE '%speaker%' OR description ILIKE '%guest%' OR description ILIKE '%honorarium%' THEN 'Guest Speakers'::VARCHAR
            WHEN description ILIKE '%software%' OR description ILIKE '%subscription%' OR description ILIKE '%domain%' THEN 'Software & Subscriptions'::VARCHAR
            ELSE 'Other Operations'::VARCHAR
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
