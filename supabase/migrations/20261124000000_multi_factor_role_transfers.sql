-- Migration: 20261124000000_multi_factor_role_transfers.sql
-- Description: Implement Multi-Factor Role Transfer Verification with Student Union Advisor approvals (#3459).

-- 1. Extend clubs table with advisor metadata
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS advisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS advisor_email TEXT NOT NULL DEFAULT 'advisor@campusconnect.test';

-- 2. Create the advisor approval status enum type
CREATE TYPE public.su_advisor_approval_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. Add advisor status column to leadership_transitions
ALTER TABLE public.leadership_transitions
ADD COLUMN IF NOT EXISTS su_advisor_approval_status public.su_advisor_approval_status NOT NULL DEFAULT 'pending';

-- 4. Redefine nominate_successor to include Outbox trigger logs
CREATE OR REPLACE FUNCTION public.nominate_successor(
  p_club_id UUID,
  p_incoming_user_id UUID,
  p_effective_date TIMESTAMPTZ,
  p_role_title TEXT DEFAULT 'President'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_holder_user_id UUID;
  v_transition_id UUID;
BEGIN
  SELECT cr.id INTO v_role_id
  FROM public.club_roles cr
  WHERE cr.club_id = p_club_id AND cr.title = p_role_title;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" does not exist for this club.', p_role_title;
  END IF;

  SELECT cm.user_id INTO v_holder_user_id
  FROM public.club_members cm
  WHERE cm.club_id = p_club_id AND cm.role_id = v_role_id AND cm.status = 'approved';

  IF v_holder_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the current % may nominate a successor.', p_role_title;
  END IF;

  IF NOT public.is_approved_club_member(p_club_id, p_incoming_user_id) THEN
    RAISE EXCEPTION 'The nominee must be an approved member of the club.';
  END IF;

  IF p_effective_date <= NOW() THEN
    RAISE EXCEPTION 'effective_date must be in the future.';
  END IF;

  INSERT INTO public.leadership_transitions (
    club_id, outgoing_user_id, incoming_user_id, role_title, effective_date, su_advisor_approval_status
  ) VALUES (
    p_club_id, auth.uid(), p_incoming_user_id, p_role_title, p_effective_date, 'pending'
  )
  RETURNING id INTO v_transition_id;

  -- Transactional Outbox insertion to trigger advisor emails
  INSERT INTO public.outbox_events (payload)
  VALUES (
    jsonb_build_object(
      'table', 'leadership_transitions',
      'action', 'TRANSITION_INITIATED',
      'record', jsonb_build_object(
        'id', v_transition_id,
        'incoming_user_id', p_incoming_user_id,
        'club_id', p_club_id
      )
    )
  );

  PERFORM public.queue_or_send_notification(
    p_user_id => p_incoming_user_id,
    p_notification_type => 'leadership_nomination',
    p_title => 'You''ve been nominated as ' || p_role_title,
    p_message => 'You''ve been nominated to become the next ' || p_role_title || '. Review and accept the nomination.',
    p_link => '/clubs/' || p_club_id || '/leadership',
    p_entity_id => v_transition_id,
    p_entity_type => 'leadership_transition',
    p_actor_id => auth.uid()
  );

  RETURN v_transition_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nominate_successor(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- 5. Redefine execute_one_leadership_transition to verify SU Advisor approval
CREATE OR REPLACE FUNCTION public.execute_one_leadership_transition(p_transition_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transition RECORD;
  v_president_role_id UUID;
  v_alumni_role_id UUID;
  v_club_title TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT * INTO v_transition
  FROM public.leadership_transitions
  WHERE id = p_transition_id
  FOR UPDATE;

  -- Require BOTH accepted status AND su advisor approval to execute role transition
  IF NOT FOUND OR v_transition.status <> 'accepted' OR v_transition.su_advisor_approval_status <> 'approved' THEN
    RETURN;
  END IF;

  SELECT president_role_id, alumni_role_id
    INTO v_president_role_id, v_alumni_role_id
  FROM public.ensure_club_transition_roles(v_transition.club_id);

  UPDATE public.club_members
  SET role_id = v_alumni_role_id
  WHERE club_id = v_transition.club_id
    AND user_id = v_transition.outgoing_user_id
    AND role_id = v_president_role_id;

  UPDATE public.club_members
  SET role_id = v_president_role_id
  WHERE club_id = v_transition.club_id
    AND user_id = v_transition.incoming_user_id;

  UPDATE public.leadership_transitions
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_transition_id;

  SELECT name INTO v_club_title FROM public.clubs WHERE id = v_transition.club_id;

  IF EXISTS (SELECT 1 FROM public.clubs WHERE id = v_transition.club_id AND stripe_account_id IS NOT NULL) THEN
    INSERT INTO public.stripe_representative_change_requests (
      club_id, transition_id, previous_representative_id, new_representative_id
    ) VALUES (
      v_transition.club_id, p_transition_id, v_transition.outgoing_user_id, v_transition.incoming_user_id
    );

    v_supabase_url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321');
    v_service_key := COALESCE(current_setting('app.service_role_key', true), '');

    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/stripe-representative-change-request',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'club_id', v_transition.club_id,
          'club_title', v_club_title,
          'transition_id', p_transition_id,
          'new_representative_id', v_transition.incoming_user_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  PERFORM public.queue_or_send_notification(
    p_user_id => v_transition.incoming_user_id,
    p_notification_type => 'leadership_promoted',
    p_title => 'You are now ' || v_transition.role_title,
    p_message => 'Your leadership transition for ' || COALESCE(v_club_title, 'the club') || ' is complete. You are now ' || v_transition.role_title || '.',
    p_link => '/clubs/' || v_transition.club_id,
    p_entity_id => v_transition.club_id,
    p_entity_type => 'club'
  );

  PERFORM public.queue_or_send_notification(
    p_user_id => v_transition.outgoing_user_id,
    p_notification_type => 'leadership_promoted',
    p_title => 'Leadership transition complete',
    p_message => 'You have handed over ' || v_transition.role_title || ' of ' || COALESCE(v_club_title, 'the club') || '. Thank you for your service!',
    p_link => '/clubs/' || v_transition.club_id,
    p_entity_id => v_transition.club_id,
    p_entity_type => 'club'
  );
END;
$$;

-- 6. RPC Function: approve_leadership_transfer(p_transition_id UUID)
CREATE OR REPLACE FUNCTION public.approve_leadership_transfer(p_transition_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is either the assigned club advisor or system admin
  IF NOT (
    public.is_system_admin() OR
    EXISTS (
      SELECT 1 FROM public.clubs c
      JOIN public.leadership_transitions lt ON lt.club_id = c.id
      WHERE lt.id = p_transition_id AND c.advisor_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized: Only the Student Union advisor or a system admin can approve transitions.';
  END IF;

  UPDATE public.leadership_transitions
  SET su_advisor_approval_status = 'approved'
  WHERE id = p_transition_id;

  -- Immediately execute the transition
  PERFORM public.execute_one_leadership_transition(p_transition_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_leadership_transfer(UUID) TO authenticated;

-- 7. RPC Function: reject_leadership_transfer(p_transition_id UUID)
CREATE OR REPLACE FUNCTION public.reject_leadership_transfer(p_transition_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is either the assigned club advisor or system admin
  IF NOT (
    public.is_system_admin() OR
    EXISTS (
      SELECT 1 FROM public.clubs c
      JOIN public.leadership_transitions lt ON lt.club_id = c.id
      WHERE lt.id = p_transition_id AND c.advisor_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized: Only the Student Union advisor or a system admin can reject transitions.';
  END IF;

  UPDATE public.leadership_transitions
  SET su_advisor_approval_status = 'rejected',
      status = 'cancelled',
      cancelled_at = NOW()
  WHERE id = p_transition_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_leadership_transfer(UUID) TO authenticated;
