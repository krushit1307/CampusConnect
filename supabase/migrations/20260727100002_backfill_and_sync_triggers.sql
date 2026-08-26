-- Zero-Downtime Schema Migration Framework (#1055)
-- Phase 2: Data Backfill Phase
-- Asynchronously migrates historical legacy rows to the new schema in small batches.

SET statement_timeout = '5s';

-- Batch Backfill Procedure
CREATE OR REPLACE FUNCTION public.backfill_event_venues(batch_size INT DEFAULT 500)
RETURNS INT AS $$
DECLARE
    rows_migrated INT := 0;
BEGIN
    WITH target_events AS (
        SELECT e.id, e.location
        FROM public.events e
        LEFT JOIN public.event_venues ev ON e.id = ev.event_id
        WHERE e.location IS NOT NULL AND e.location <> '' AND ev.id IS NULL
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    ),
    inserted_venues AS (
        INSERT INTO public.event_venues (event_id, venue_name, address)
        SELECT id, location, location FROM target_events
        RETURNING event_id, id AS venue_id
    )
    UPDATE public.events e
    SET venue_id = iv.venue_id
    FROM inserted_venues iv
    WHERE e.id = iv.event_id;

    GET DIAGNOSTICS rows_migrated = ROW_COUNT;
    RETURN rows_migrated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
