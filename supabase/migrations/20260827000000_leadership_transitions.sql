-- ============================================================
-- Migration: 20260827000000_leadership_transitions.sql
-- Description:
--   "Digital Handshake" protocol for formalized club leadership
--   handover. An outgoing club leader nominates a successor, the
--   successor must explicitly accept, and a daily midnight cron job
--   atomically swaps roles once the accepted transition's effective
--   date arrives. Also adds a Student Union "hostile takeover"
--   petition path for orphaned clubs.
--
--   ARCHITECTURE NOTE: this repo has two disconnected authorization
--   systems — the dynamic per-club `club_roles`/`club_members.role_id`
--   system (used by is_club_admin(), the election module, storage
--   policies, etc. — genuinely live and exercised throughout) and a
--   separate global `roles`/`user_roles`/has_permission() hierarchical
--   RBAC system (20260725200000_rbac_hierarchical.sql) that could not
--   actually apply at all until this migration fixed a missing comma
--   in it — meaning it has never been live in any environment that
--   runs a full `supabase db reset`. This migration builds "who is
--   President of this club" on the first (working, tested) system.
--   Reconciling the two RBAC systems is a real, separate problem
--   worth its own issue — not attempted here.
-- ============================================================

-- ── Step 0: prerequisite fix ──────────────────────────────────────
-- 20260725200000_rbac_hierarchical.sql had `(3, 'members.manage')
-- (3, 'clubs.create')` with no comma between them — invalid SQL that
-- hard-failed `supabase db reset` before reaching ANY later migration,
-- including this one. Fixed in that file directly (see its own diff);
-- noted here since it's why this feature was blocked in the first
-- place.

-- ── Step 0b: prerequisite fix ──────────────────────────────────────
-- 20260728000006_cascade_delete_profile_fks.sql set clubs.created_by
-- to ON DELETE CASCADE. That means if a club's original founder
-- later graduates and deletes their account — exactly the
-- "graduation abandonment" scenario this issue's Hostile Takeover
-- workflow exists to recover from — the ENTIRE CLUB is destroyed
-- along with their profile, not just left presidentless. There would
-- be nothing left for a petition to recover. clubs.created_by is
-- historical "who founded this" metadata, not something that should
-- take the whole club down with it; SET NULL preserves the original
-- migration's actual goal (deleting a profile shouldn't error out on
-- a dangling reference) without destroying club data other members
-- and leaders still depend on. Scoped ONLY to clubs.created_by —
-- events.created_by / polls.created_by are a separate judgment call
-- outside this issue.
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_created_by_fkey;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Step 1: singular-role enforcement on club_roles/club_members ──
-- "President" (and any future role like it) can only be held by one
-- member per club at a time — this is what the whole handshake
-- protocol exists to protect. `is_singular` marks which club_roles
-- rows carry that constraint; a trigger below enforces it.

ALTER TABLE public.club_roles ADD COLUMN IF NOT EXISTS is_singular BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.enforce_singular_club_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_singular BOOLEAN;
  v_conflict_exists BOOLEAN;
BEGIN
  SELECT is_singular INTO v_is_singular FROM public.club_roles WHERE id = NEW.role_id;
  IF v_is_singular IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.role_id = NEW.role_id
      AND cm.user_id IS DISTINCT FROM NEW.user_id
  ) INTO v_conflict_exists;

  IF v_conflict_exists THEN
    RAISE EXCEPTION 'This role can only be held by one member of the club at a time.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_member_singular_role ON public.club_members;
CREATE TRIGGER on_club_member_singular_role
  BEFORE INSERT OR UPDATE OF role_id ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_singular_club_role();

-- ── Step 2: ensure every club has President / Alumni roles ────────
-- Creates them if missing, using ON CONFLICT so this is safe to run
-- against clubs that already have their own Admin/Member roles from
-- 20260720000006_dynamic_club_roles.sql. President is marked
-- is_singular; Alumni is a low-permission holding tier for graduated
-- leaders — this is a deliberately MINIMAL implementation scoped
-- only to what this transition system needs (a place to move an
-- outgoing leader to). The full "Alumni role and access tier" is
-- tracked separately in issue #2856; this doesn't attempt to solve
-- that more broadly (alumni event access, alumni directories, etc.).

CREATE OR REPLACE FUNCTION public.ensure_club_transition_roles(p_club_id UUID)
RETURNS TABLE (president_role_id UUID, alumni_role_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.club_roles (club_id, title, permissions_level, is_singular)
  VALUES (p_club_id, 'President', 100, TRUE)
  ON CONFLICT (club_id, title) DO NOTHING;

  INSERT INTO public.club_roles (club_id, title, permissions_level, is_singular)
  VALUES (p_club_id, 'Alumni', 0, FALSE)
  ON CONFLICT (club_id, title) DO NOTHING;

  RETURN QUERY
  SELECT
    (SELECT id FROM public.club_roles WHERE club_id = p_club_id AND title = 'President'),
    (SELECT id FROM public.club_roles WHERE club_id = p_club_id AND title = 'Alumni');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_club_transition_roles(UUID) TO authenticated, service_role;

-- ── Step 3: leadership_transitions table ───────────────────────────

CREATE TYPE transition_status AS ENUM (
  'pending_acceptance', 'accepted', 'completed', 'cancelled', 'expired'
);

CREATE TABLE public.leadership_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  outgoing_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  incoming_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL DEFAULT 'President',
  effective_date TIMESTAMPTZ NOT NULL,
  status transition_status NOT NULL DEFAULT 'pending_acceptance',
  nominated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT check_transition_not_self CHECK (outgoing_user_id <> incoming_user_id)
);

-- A plain CHECK constraint re-validates on every UPDATE, not just
-- INSERT — the same class of bug already found and fixed in the
-- election module's end_time check. Nothing in this migration's own
-- RPCs ever updates effective_date after creation, so it's not
-- exploitable today, but it would silently break the moment anyone
-- added an "edit transition date" feature later, or even just wrote a
-- test that backdates the column to simulate time passing (exactly
-- what happened while testing this locally). INSERT-only trigger
-- instead, so it only ever validates what it was meant to.
CREATE OR REPLACE FUNCTION public.check_transition_effective_date_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.effective_date <= NOW() THEN
    RAISE EXCEPTION 'effective_date must be in the future when a transition is created.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_transition_effective_date_on_create
  BEFORE INSERT ON public.leadership_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transition_effective_date_on_create();

-- At most one LIVE (not yet completed/cancelled/expired) transition
-- per club+role at a time — you can't nominate a second successor
-- while one nomination is already pending or accepted.
CREATE UNIQUE INDEX idx_one_live_transition_per_role
  ON public.leadership_transitions (club_id, role_title)
  WHERE status IN ('pending_acceptance', 'accepted');

CREATE INDEX idx_leadership_transitions_due
  ON public.leadership_transitions (effective_date)
  WHERE status = 'accepted';

ALTER TABLE public.leadership_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view their club's transitions."
  ON public.leadership_transitions FOR SELECT
  USING (public.is_approved_club_member(club_id, auth.uid()));

-- No direct INSERT/UPDATE/DELETE policies for `authenticated` at all —
-- every write goes through the narrow RPCs below, each of which
-- enforces its own specific rule (who can nominate, who can accept,
-- when a cancellation is still allowed) rather than relying on a
-- blanket RLS policy that can't express "only before effective_date".

-- ── Step 4: nominate_successor RPC ─────────────────────────────────

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

  -- Only the CURRENT holder of the role being handed over may nominate
  -- a successor for it (not just any club admin).
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
    club_id, outgoing_user_id, incoming_user_id, role_title, effective_date
  ) VALUES (
    p_club_id, auth.uid(), p_incoming_user_id, p_role_title, p_effective_date
  )
  RETURNING id INTO v_transition_id;

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

-- ── Step 5: accept_nomination RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_nomination(p_transition_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.leadership_transitions
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = p_transition_id
    AND incoming_user_id = auth.uid()
    AND status = 'pending_acceptance';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Not permitted: not your nomination, or it is no longer pending.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_nomination(UUID) TO authenticated;

-- ── Step 6: cancel_transition RPC ("cold feet" edge case) ─────────
-- The outgoing leader can cancel right up until the exact
-- effective_date — after that, the cron job may already be running.

CREATE OR REPLACE FUNCTION public.cancel_transition(p_transition_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.leadership_transitions
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_transition_id
    AND outgoing_user_id = auth.uid()
    AND status IN ('pending_acceptance', 'accepted')
    AND effective_date > NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Not permitted: not your transition, already resolved, or past its effective date.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_transition(UUID) TO authenticated;

-- ── Step 7: Stripe Connect representative change queue ────────────
-- Automatically re-pointing a live Stripe Connect account's
-- "representative" is NOT something this migration attempts to do via
-- a direct API call. That's a real KYC action — the new representative
-- must personally complete identity verification through Stripe's own
-- hosted onboarding (Account Links), which cannot be triggered on
-- someone's behalf by an email or a cron job. What this DOES do is
-- reliably queue the request and notify the right humans so the
-- process starts promptly instead of silently not happening.

CREATE TABLE public.stripe_representative_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  transition_id UUID REFERENCES public.leadership_transitions(id) ON DELETE SET NULL,
  previous_representative_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_manual_review'
    CHECK (status IN ('pending_manual_review', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_representative_change_requests ENABLE ROW LEVEL SECURITY;
-- No policies at all for `authenticated` — finance/ops review these via
-- the service_role-backed admin tooling only, same "no policy = no
-- client access" pattern used for pending_notifications and votes.

-- ── Step 8: the midnight cron job ──────────────────────────────────

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

  IF NOT FOUND OR v_transition.status <> 'accepted' THEN
    RETURN;
  END IF;

  SELECT president_role_id, alumni_role_id
    INTO v_president_role_id, v_alumni_role_id
  FROM public.ensure_club_transition_roles(v_transition.club_id);

  -- Demote first, promote second — at no point do two members
  -- simultaneously hold the singular role (see Step 1's trigger),
  -- and both writes commit together as part of this one function call.
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

  -- Queue the Stripe Connect representative handover for manual
  -- completion (see Step 7 for why this isn't a live API call).
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
      NULL; -- the queued row above is the durable record; the email is best-effort
    END;
  END IF;

  -- Immediate notifications to both parties — this is exactly the kind
  -- of critical, low-volume event that should bypass the batching
  -- queue from the notification-batching work.
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

CREATE OR REPLACE FUNCTION public.process_daily_leadership_transitions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM public.leadership_transitions
    WHERE status = 'accepted' AND effective_date <= NOW()
  LOOP
    -- Each transition gets its own exception-catching block (an
    -- implicit savepoint in plpgsql) so one bad row — a deleted
    -- profile, a role that vanished — can't block every other
    -- club's transition from completing that night.
    BEGIN
      PERFORM public.execute_one_leadership_transition(rec.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Leadership transition % failed: %', rec.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_daily_leadership_transitions() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-leadership-transitions') THEN
    PERFORM cron.unschedule('process-leadership-transitions');
  END IF;
END
$$;

SELECT cron.schedule(
  'process-leadership-transitions',
  '0 0 * * *',
  $$SELECT public.process_daily_leadership_transitions();$$
);

-- ── Step 9: "Hostile Takeover" — Student Union recovery petitions ─

CREATE TABLE public.club_recovery_petitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  petitioner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_president_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_recovery_petitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Petitioners can view their own petitions."
  ON public.club_recovery_petitions FOR SELECT
  USING (petitioner_user_id = auth.uid() OR public.is_system_admin());

-- No direct INSERT/UPDATE for `authenticated` — both actions go
-- through the RPCs below so petitioning and resolving stay auditable
-- and validated (membership required to petition; system_admin
-- required to resolve).

CREATE OR REPLACE FUNCTION public.petition_for_club_recovery(
  p_club_id UUID,
  p_proposed_president_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_petition_id UUID;
BEGIN
  IF NOT public.is_approved_club_member(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only approved members of this club may petition for recovery.';
  END IF;

  IF NOT public.is_approved_club_member(p_club_id, p_proposed_president_id) THEN
    RAISE EXCEPTION 'The proposed president must be an approved member of the club.';
  END IF;

  INSERT INTO public.club_recovery_petitions (club_id, petitioner_user_id, proposed_president_id, reason)
  VALUES (p_club_id, auth.uid(), p_proposed_president_id, p_reason)
  RETURNING id INTO v_petition_id;

  RETURN v_petition_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.petition_for_club_recovery(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_club_recovery_petition(
  p_petition_id UUID,
  p_approve BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_petition RECORD;
  v_president_role_id UUID;
  v_alumni_role_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only the Student Union (system_admin) may resolve recovery petitions.';
  END IF;

  SELECT * INTO v_petition FROM public.club_recovery_petitions WHERE id = p_petition_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Petition not found or already resolved.';
  END IF;

  UPDATE public.club_recovery_petitions
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_petition_id;

  IF NOT p_approve THEN
    RETURN;
  END IF;

  -- This is the deliberate bypass: no nomination, no acceptance —
  -- the Student Union is directly installing a President because the
  -- normal handshake was never possible (the outgoing leader is gone).
  SELECT president_role_id, alumni_role_id
    INTO v_president_role_id, v_alumni_role_id
  FROM public.ensure_club_transition_roles(v_petition.club_id);

  -- Move anyone currently holding President (if the account still
  -- exists but is simply unresponsive, rather than deleted) to Alumni
  -- first, same demote-then-promote ordering as the normal flow.
  UPDATE public.club_members
  SET role_id = v_alumni_role_id
  WHERE club_id = v_petition.club_id AND role_id = v_president_role_id;

  -- If the proposed president isn't already a club_members row for
  -- some reason, this won't create one — petitioning requires
  -- approved membership already (enforced above at petition time).
  UPDATE public.club_members
  SET role_id = v_president_role_id
  WHERE club_id = v_petition.club_id AND user_id = v_petition.proposed_president_id;

  PERFORM public.queue_or_send_notification(
    p_user_id => v_petition.proposed_president_id,
    p_notification_type => 'leadership_promoted',
    p_title => 'You are now President',
    p_message => 'The Student Union approved a club recovery petition installing you as President.',
    p_link => '/clubs/' || v_petition.club_id,
    p_entity_id => v_petition.club_id,
    p_entity_type => 'club'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_club_recovery_petition(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- End of migration
-- ============================================================
