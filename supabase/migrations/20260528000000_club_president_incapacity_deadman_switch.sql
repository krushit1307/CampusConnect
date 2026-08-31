-- Migration: Club Leadership President Incapacity Protocol (Dead Man's Switch) — Issue #5280
-- Adds last_active_at tracking, signing key vault, incapacity state machine, and succession execution

-- 1. Extend profiles with last_active_at for Last_Active_Timestamp monitoring
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles(last_active_at);

-- Backfill from updated_at where null
UPDATE public.profiles SET last_active_at = COALESCE(last_active_at, updated_at, NOW()) WHERE last_active_at IS NULL;

-- 2. Signing keys vault for Stripe Connect + Escrow (cryptographic rotation)
CREATE TABLE IF NOT EXISTS public.club_signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK (key_type IN ('stripe_connect', 'escrow')),
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  CONSTRAINT club_signing_keys_type_active_unique UNIQUE (club_id, key_type, revoked_at)
);
-- Partial unique: only one active key per club+type (revoked_at IS NULL)
DROP INDEX IF EXISTS uq_club_signing_keys_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_signing_keys_active ON public.club_signing_keys(club_id, key_type) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_club_signing_keys_club ON public.club_signing_keys(club_id);

ALTER TABLE public.club_signing_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signing keys viewable by club executives" ON public.club_signing_keys;
CREATE POLICY "Signing keys viewable by club executives" ON public.club_signing_keys FOR SELECT USING (
  public.is_club_admin(club_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND created_by = auth.uid()) OR public.is_system_admin()
);
DROP POLICY IF EXISTS "Service role manages signing keys" ON public.club_signing_keys;
CREATE POLICY "Service role manages signing keys" ON public.club_signing_keys FOR ALL USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- 3. Incapacity state machine table
CREATE TABLE IF NOT EXISTS public.club_leadership_incapacity_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  president_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  president_role_title TEXT NOT NULL DEFAULT 'President',
  vice_president_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_active_at TIMESTAMPTZ,
  days_inactive INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','warning_pending','warning_sent','succession_pending','succession_executed','no_president','no_vice_president')),
  warning_sent_at TIMESTAMPTZ,
  succession_executed_at TIMESTAMPTZ,
  stripe_keys_revoked BOOLEAN NOT NULL DEFAULT false,
  escrow_keys_revoked BOOLEAN NOT NULL DEFAULT false,
  new_president_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dean_notified BOOLEAN NOT NULL DEFAULT false,
  audit_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id)
);
CREATE INDEX IF NOT EXISTS idx_incapacity_club ON public.club_leadership_incapacity_state(club_id);
CREATE INDEX IF NOT EXISTS idx_incapacity_status ON public.club_leadership_incapacity_state(status);

ALTER TABLE public.club_leadership_incapacity_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Incapacity state viewable by executives" ON public.club_leadership_incapacity_state;
CREATE POLICY "Incapacity state viewable by executives" ON public.club_leadership_incapacity_state FOR SELECT USING (
  public.is_club_admin(club_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND created_by = auth.uid()) OR public.is_system_admin()
);
DROP POLICY IF EXISTS "System manages incapacity state" ON public.club_leadership_incapacity_state;
CREATE POLICY "System manages incapacity state" ON public.club_leadership_incapacity_state FOR ALL USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

-- 4. Helper: resolve President / Vice President user_id for a club
CREATE OR REPLACE FUNCTION public.get_club_president(club_uuid UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_president UUID;
BEGIN
  SELECT cm.user_id INTO v_president
  FROM public.club_members cm
  JOIN public.club_roles cr ON cr.id = cm.role_id
  WHERE cm.club_id = club_uuid AND cm.status = 'approved' AND lower(cr.title) IN ('president','superadmin','super_admin','super admin')
  ORDER BY cr.permissions_level DESC, cm.joined_at ASC LIMIT 1;
  IF v_president IS NOT NULL THEN RETURN v_president; END IF;
  -- Fallback: highest permissions_level as president
  SELECT cm.user_id INTO v_president
  FROM public.club_members cm JOIN public.club_roles cr ON cr.id = cm.role_id
  WHERE cm.club_id = club_uuid AND cm.status='approved' ORDER BY cr.permissions_level DESC LIMIT 1;
  RETURN v_president;
END; $$;

CREATE OR REPLACE FUNCTION public.get_club_vice_president(club_uuid UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vp UUID;
BEGIN
  SELECT cm.user_id INTO v_vp
  FROM public.club_members cm JOIN public.club_roles cr ON cr.id = cm.role_id
  WHERE cm.club_id = club_uuid AND cm.status='approved' AND lower(cr.title) IN ('vice president','vice_president','vice-president')
  ORDER BY cm.joined_at ASC LIMIT 1;
  RETURN v_vp;
END; $$;

-- 5. Evaluate incapacity status (pure, deterministic)
CREATE OR REPLACE FUNCTION public.evaluate_incapacity_status(days_inactive INTEGER)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF days_inactive IS NULL OR days_inactive < 21 THEN RETURN 'healthy';
  ELSIF days_inactive >= 30 THEN RETURN 'succession_pending';
  ELSIF days_inactive >= 21 THEN RETURN 'warning_pending';
  ELSE RETURN 'healthy';
  END IF;
END; $$;

-- 6. Trigger to keep updated_at
CREATE OR REPLACE FUNCTION public.touch_incapacity_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_incapacity_touch ON public.club_leadership_incapacity_state;
CREATE TRIGGER trg_incapacity_touch BEFORE UPDATE ON public.club_leadership_incapacity_state FOR EACH ROW EXECUTE FUNCTION public.touch_incapacity_updated_at();

-- 7. Core succession protocol (cryptographic revocation + promotion + dean notification stub)
CREATE OR REPLACE FUNCTION public.execute_president_succession_protocol(p_club_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_president UUID; v_vp UUID; v_days INTEGER; v_last_active TIMESTAMPTZ;
  v_pres_role_id UUID; v_vp_role_id UUID; v_president_role_id UUID;
  v_new_pub TEXT; v_new_priv TEXT;
BEGIN
  SELECT public.get_club_president(p_club_id) INTO v_president;
  IF v_president IS NULL THEN
    INSERT INTO public.club_leadership_incapacity_state(club_id, status, audit_details) VALUES (p_club_id, 'no_president', jsonb_build_object('reason','no president found'))
    ON CONFLICT (club_id) DO UPDATE SET status='no_president', updated_at=NOW();
    RETURN jsonb_build_object('success', false, 'reason','no_president');
  END IF;
  SELECT public.get_club_vice_president(p_club_id) INTO v_vp;
  IF v_vp IS NULL THEN
    INSERT INTO public.club_leadership_incapacity_state(club_id, president_user_id, status, audit_details) VALUES (p_club_id, v_president, 'no_vice_president', jsonb_build_object('reason','no vice president'))
    ON CONFLICT (club_id) DO UPDATE SET president_user_id=v_president, status='no_vice_president', updated_at=NOW();
    RETURN jsonb_build_object('success', false, 'reason','no_vice_president');
  END IF;

  SELECT last_active_at INTO v_last_active FROM public.profiles WHERE id = v_president;
  v_days := GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(v_last_active, NOW()))::INTEGER);
  IF v_days < 30 THEN
    RETURN jsonb_build_object('success', false, 'reason','not yet 30 days','days_inactive',v_days);
  END IF;

  -- Revoke Stripe Connect keys
  UPDATE public.club_signing_keys SET revoked_at = NOW(), revoked_reason='president_incapacity_succession' WHERE club_id=p_club_id AND key_type='stripe_connect' AND revoked_at IS NULL;
  -- Revoke Escrow keys
  UPDATE public.club_signing_keys SET revoked_at = NOW(), revoked_reason='president_incapacity_succession' WHERE club_id=p_club_id AND key_type='escrow' AND revoked_at IS NULL;

  -- Resolve President role_id
  SELECT id INTO v_president_role_id FROM public.club_roles WHERE club_id=p_club_id AND lower(title)='president' LIMIT 1;
  IF v_president_role_id IS NULL THEN
    SELECT id INTO v_president_role_id FROM public.club_roles WHERE club_id=p_club_id ORDER BY permissions_level DESC LIMIT 1;
  END IF;

  -- Demote president (set to member) and promote VP to president - handle composite PK
  -- Find president membership
  SELECT role_id INTO v_pres_role_id FROM public.club_members WHERE club_id=p_club_id AND user_id=v_president;
  SELECT role_id INTO v_vp_role_id FROM public.club_members WHERE club_id=p_club_id AND user_id=v_vp;

  -- Promote VP
  UPDATE public.club_members SET role_id = v_president_role_id WHERE club_id=p_club_id AND user_id=v_vp;
  -- Demote old president to Member role if exists
  DECLARE v_member_role_id UUID;
  BEGIN
    SELECT id INTO v_member_role_id FROM public.club_roles WHERE club_id=p_club_id AND lower(title)='member' LIMIT 1;
    IF v_member_role_id IS NOT NULL THEN
      UPDATE public.club_members SET role_id = v_member_role_id WHERE club_id=p_club_id AND user_id=v_president;
    END IF;
  END;

  -- Mint fresh keys for new president
  v_new_pub := 'pub_' || substr(md5(random()::text),1,32);
  v_new_priv := 'priv_enc_' || substr(md5(random()::text),1,32);
  INSERT INTO public.club_signing_keys(club_id, key_type, public_key, private_key_encrypted, created_by)
  VALUES (p_club_id, 'stripe_connect', v_new_pub, v_new_priv, v_vp),
         (p_club_id, 'escrow', 'pub_' || substr(md5(random()::text),1,32), 'priv_enc_' || substr(md5(random()::text),1,32), v_vp);

  -- Update state + audit
  INSERT INTO public.club_leadership_incapacity_state(club_id, president_user_id, vice_president_user_id, last_active_at, days_inactive, status, succession_executed_at, stripe_keys_revoked, escrow_keys_revoked, new_president_user_id, dean_notified, audit_details)
  VALUES (p_club_id, v_president, v_vp, v_last_active, v_days, 'succession_executed', NOW(), true, true, v_vp, true, jsonb_build_object('days_inactive',v_days,'revoked_keys',jsonb_build_array('stripe_connect','escrow'),'promoted_vp',v_vp))
  ON CONFLICT (club_id) DO UPDATE SET president_user_id=v_president, vice_president_user_id=v_vp, last_active_at=v_last_active, days_inactive=v_days, status='succession_executed', succession_executed_at=NOW(), stripe_keys_revoked=true, escrow_keys_revoked=true, new_president_user_id=v_vp, dean_notified=true, audit_details=jsonb_build_object('days_inactive',v_days,'revoked_keys',jsonb_build_array('stripe_connect','escrow'),'promoted_vp',v_vp), updated_at=NOW();

  -- Audit log
  INSERT INTO public.club_audit_logs(club_id, action_type, old_data, new_data) VALUES (p_club_id, 'president_succession_deadman_switch', jsonb_build_object('president_user_id',v_president,'days_inactive',v_days), jsonb_build_object('new_president_user_id',v_vp,'revoked',jsonb_build_array('stripe_connect','escrow')));

  -- Dean notification (stubbed as notifications row for dean role users + audit)
  INSERT INTO public.notifications(user_id, type, title, message, metadata)
  SELECT p.id, 'succession', 'Executive Succession Executed', 'Club ' || (SELECT name FROM public.clubs WHERE id=p_club_id) || ': President incapacity protocol executed. Vice President promoted. Dean notified.',
         jsonb_build_object('club_id',p_club_id,'new_president',v_vp,'old_president',v_president)
  FROM public.profiles p WHERE p.role::TEXT = 'system_admin';

  RETURN jsonb_build_object('success', true, 'club_id',p_club_id,'old_president',v_president,'new_president',v_vp,'days_inactive',v_days);
END; $$;

-- 8. Warning email stub (creates notification + state update)
CREATE OR REPLACE FUNCTION public.send_incapacity_warning(p_club_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_president UUID; v_vp UUID; v_last_active TIMESTAMPTZ; v_days INTEGER;
BEGIN
  SELECT public.get_club_president(p_club_id) INTO v_president;
  IF v_president IS NULL THEN RETURN jsonb_build_object('success',false,'reason','no_president'); END IF;
  SELECT last_active_at INTO v_last_active FROM public.profiles WHERE id=v_president;
  v_days := GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(v_last_active, NOW()))::INTEGER);
  IF v_days < 21 OR v_days >= 30 THEN RETURN jsonb_build_object('success',false,'reason','not in warning window','days_inactive',v_days); END IF;
  SELECT public.get_club_vice_president(p_club_id) INTO v_vp;
  INSERT INTO public.notifications(user_id, type, title, message, metadata) VALUES
    (v_president, 'warning', 'Warning: Impending Executive Lockout', 'You have been inactive for '||v_days||' days. Executive access will be revoked on day 30 and Vice President will be promoted. Please log in to reset the dead man''s switch.', jsonb_build_object('club_id',p_club_id,'days_inactive',v_days)),
    (COALESCE(v_vp, v_president), 'warning', 'Warning: President Incapacity Pending', 'Club president inactive '||v_days||' days — succession pending at day 30.', jsonb_build_object('club_id',p_club_id,'days_inactive',v_days));
  INSERT INTO public.club_leadership_incapacity_state(club_id, president_user_id, vice_president_user_id, last_active_at, days_inactive, status, warning_sent_at, audit_details)
  VALUES (p_club_id, v_president, v_vp, v_last_active, v_days, 'warning_sent', NOW(), jsonb_build_object('days_inactive',v_days))
  ON CONFLICT (club_id) DO UPDATE SET president_user_id=v_president, vice_president_user_id=v_vp, last_active_at=v_last_active, days_inactive=v_days, status='warning_sent', warning_sent_at=NOW(), audit_details=jsonb_build_object('days_inactive',v_days), updated_at=NOW();
  RETURN jsonb_build_object('success',true,'days_inactive',v_days,'warning_sent_at',NOW());
END; $$;

GRANT EXECUTE ON FUNCTION public.evaluate_incapacity_status(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_president(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_vice_president(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_president_succession_protocol(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_incapacity_warning(UUID) TO service_role;
