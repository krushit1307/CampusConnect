-- Write database trigger to automatically issue event certificates upon check-in

CREATE OR REPLACE FUNCTION public.issue_certificate_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a certificate row if one does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM public.certificates 
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id
  ) THEN
    INSERT INTO public.certificates (event_id, user_id, certificate_url)
    VALUES (NEW.event_id, NEW.user_id, 'pending');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire AFTER UPDATE on event_rsvps when checked_in changes to TRUE
DROP TRIGGER IF EXISTS trg_issue_certificate_on_checkin ON public.event_rsvps;

CREATE TRIGGER trg_issue_certificate_on_checkin
AFTER UPDATE OF checked_in ON public.event_rsvps
FOR EACH ROW
WHEN (OLD.checked_in IS DISTINCT FROM TRUE AND NEW.checked_in = TRUE)
EXECUTE FUNCTION public.issue_certificate_on_checkin();
