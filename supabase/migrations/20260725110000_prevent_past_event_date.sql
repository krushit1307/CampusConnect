CREATE OR REPLACE FUNCTION public.check_event_date_not_past()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_date IS NOT NULL AND NEW.event_date < NOW() THEN
    RAISE EXCEPTION 'Event date cannot be in the past. Provided: %', NEW.event_date
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.start_date IS NOT NULL AND NEW.start_date < NOW() THEN
    RAISE EXCEPTION 'Start date cannot be in the past. Provided: %', NEW.start_date
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_past_event_date ON public.events;

CREATE TRIGGER prevent_past_event_date
  BEFORE INSERT OR UPDATE OF event_date, start_date
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_event_date_not_past();
