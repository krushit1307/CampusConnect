-- Secure event_resources via RLS so only attendees (users with an RSVP) and club admins can view them

DROP POLICY IF EXISTS "Event resources can be viewed everyone." ON public.event_resources;
DROP POLICY IF EXISTS "Event resources can be viewed by attendees and admins." ON public.event_resources;

CREATE POLICY "Event resources can be viewed by attendees and admins."
ON public.event_resources
FOR SELECT
USING (
  -- Allow access if auth.uid() exists in event_rsvps for the corresponding event_id
  EXISTS (
    SELECT 1
    FROM public.event_rsvps
    WHERE public.event_rsvps.event_id = event_resources.event_id
      AND public.event_rsvps.user_id = auth.uid()
  )
  OR
  -- Allow club admins to view all resources for their events
  public.is_club_admin(
    (SELECT club_id FROM public.events WHERE id = event_resources.event_id),
    auth.uid()
  )
  OR
  -- Allow club owner/creator to view all resources for their events
  EXISTS (
    SELECT 1
    FROM public.clubs
    WHERE public.clubs.id = (SELECT club_id FROM public.events WHERE id = event_resources.event_id)
      AND public.clubs.created_by = auth.uid()
  )
);
