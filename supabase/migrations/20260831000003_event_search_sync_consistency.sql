-- Event Search Index Synchronization (#5224)
--
-- Uses the existing events.version value as the ordering/version
-- number for search synchronization.
--
-- A newer event version is never allowed to be overwritten by an
-- older webhook/DLQ event.

ALTER TABLE public.meilisearch_dlq
  ADD COLUMN IF NOT EXISTS sync_version INTEGER;

-- A retry for the exact same event version must not create another
-- DLQ entry.
CREATE UNIQUE INDEX IF NOT EXISTS
  idx_meilisearch_dlq_event_version
ON public.meilisearch_dlq (
  table_name,
  record_id,
  operation,
  sync_version
)
WHERE sync_version IS NOT NULL;


-- Store the event version in the search document itself.
-- Meilisearch uses this value only for synchronization ordering;
-- the application does not display it.
COMMENT ON COLUMN public.meilisearch_dlq.sync_version IS
'Event version captured when the search synchronization event was generated. Older versions must never overwrite newer search documents.';


-- Keep deleted/cancelled events out of active search results.
-- deleted_at is already used by the project's event soft-delete
-- mechanism, while status handles explicit cancellation.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS search_sync_version INTEGER
  NOT NULL DEFAULT 1;


-- Keep the search sync version aligned with the existing event OCC
-- version. This avoids introducing a second independent version
-- counter.
CREATE OR REPLACE FUNCTION public.sync_event_search_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_sync_version := COALESCE(NEW.version, OLD.version, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_event_search_sync_version
ON public.events;

CREATE TRIGGER trigger_event_search_sync_version
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_event_search_version();


-- Existing rows receive their current OCC version.
UPDATE public.events
SET search_sync_version = COALESCE(version, 1)
WHERE search_sync_version IS NULL
   OR search_sync_version <> COALESCE(version, 1);


COMMENT ON COLUMN public.events.search_sync_version IS
'Version of the event represented by the current search synchronization state. Derived from events.version.';


-- Make event status and deletion state filterable in Meilisearch.
-- The Edge Function/search proxy uses these fields to exclude
-- cancelled and soft-deleted events from active discovery.