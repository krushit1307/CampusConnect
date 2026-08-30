CREATE OR REPLACE FUNCTION public.update_co_sponsor_revenue_split(
  p_request_id UUID,
  p_revenue_split JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.co_sponsors;
BEGIN
  SELECT * INTO v_request
  FROM public.co_sponsors
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Co-sponsorship request was not found.' USING ERRCODE = 'P0002';
  END IF;
  
  IF NOT public.is_event_admin(v_request.event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the event organizer can update the revenue split.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.co_sponsors
  SET revenue_split = p_revenue_split, updated_at = NOW()
  WHERE id = v_request.id;

  RETURN jsonb_build_object('success', TRUE, 'status', 'updated');
END;
$$;
