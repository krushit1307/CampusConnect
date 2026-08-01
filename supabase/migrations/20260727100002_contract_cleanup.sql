-- Zero-Downtime Schema Migration Framework (#1055)
-- Phase 4: Contract Phase
-- Clean up synchronization triggers and deprecate legacy columns once code migration is 100% complete.

SET lock_timeout = '3s';

-- 1. Drop dual-write sync trigger
DROP TRIGGER IF EXISTS sync_event_location_expand_trg ON public.events;
DROP FUNCTION IF EXISTS public.trg_sync_event_location_expand();

-- 2. Drop backfill helper procedure
DROP FUNCTION IF EXISTS public.backfill_event_venues(INT);

-- 3. Safely drop legacy location column (Optional final step after all application servers use venue_id)
-- ALTER TABLE public.events DROP COLUMN IF EXISTS location;
