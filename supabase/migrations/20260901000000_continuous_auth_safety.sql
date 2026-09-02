-- Migration: 20260901000000_continuous_auth_safety.sql
-- Description: Continuous Authentication & Emergency Lock safety schema.
-- Adds kinematic signature profiles, safety alerts audit log, escrow lock state,
-- and duress PIN configuration for real-time snatch/struggle detection.

-- ============================================================
-- 1. ESCROW LOCKS TABLE
--    Represents "locked" sensitive resources. The Continuous
--    Authentication system silently locks escrow on anomaly.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escrow_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_reason TEXT,
    duress_flag BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    unlocked_at TIMESTAMPTZ,
    requires_reauth BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_locks_user_id ON public.escrow_locks(user_id);

-- ============================================================
-- 2. KINEMATIC PROFILES TABLE
--    Stores the user's baseline kinematic signature (device hold
--    angle, gait frequency, accelerometer/gyroscope baselines)
--    used by the continuous-auth anomaly detector.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kinematic_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    baseline JSONB NOT NULL,
    sensor_type TEXT NOT NULL DEFAULT 'device_motion',
    model_version TEXT,
    threshold REAL,
    calibration_count INTEGER NOT NULL DEFAULT 0,
    last_calibrated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. SAFETY ALERTS TABLE
--    Audit log for anomaly detections, duress triggers, and
--    lock events.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.safety_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    confidence_score REAL,
    sensor_snapshot JSONB,
    locked_escrow BOOLEAN NOT NULL DEFAULT FALSE,
    duress_indicated BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_alerts_user_id ON public.safety_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_created_at ON public.safety_alerts(created_at);

-- ============================================================
-- 4. DURESS PIN CONFIGURATION
--    A secondary "duress PIN" that appears to unlock normally,
--    but actually triggers a silent campus security alert.
--    Stored as a bcrypt-compatible hash.
-- ============================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS duress_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS safety_monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.escrow_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kinematic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — ESCROW LOCKS
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own escrow lock state" ON public.escrow_locks;
CREATE POLICY "Users can view their own escrow lock state" ON public.escrow_locks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages escrow locks" ON public.escrow_locks;
CREATE POLICY "Service role manages escrow locks" ON public.escrow_locks
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 7. RLS POLICIES — KINEMATIC PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own kinematic profile" ON public.kinematic_profiles;
CREATE POLICY "Users can view their own kinematic profile" ON public.kinematic_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their own kinematic profile" ON public.kinematic_profiles;
CREATE POLICY "Users can upsert their own kinematic profile" ON public.kinematic_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own kinematic profile" ON public.kinematic_profiles;
CREATE POLICY "Users can update their own kinematic profile" ON public.kinematic_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages kinematic profiles" ON public.kinematic_profiles;
CREATE POLICY "Service role manages kinematic profiles" ON public.kinematic_profiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 8. RLS POLICIES — SAFETY ALERTS
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own safety alerts" ON public.safety_alerts;
CREATE POLICY "Users can view their own safety alerts" ON public.safety_alerts
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages safety alerts" ON public.safety_alerts;
CREATE POLICY "Service role manages safety alerts" ON public.safety_alerts
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 9. RPC FUNCTIONS
-- ============================================================

-- Locks escrow for a user (called by client AND edge function)
CREATE OR REPLACE FUNCTION public.lock_user_escrow(
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_duress_flag BOOLEAN DEFAULT FALSE
)
RETURNS public.escrow_locks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock public.escrow_locks;
BEGIN
    INSERT INTO public.escrow_locks (user_id, is_locked, lock_reason, duress_flag, locked_at, requires_reauth)
    VALUES (p_user_id, TRUE, p_reason, p_duress_flag, NOW(), TRUE)
    ON CONFLICT (user_id)
    DO UPDATE SET
        is_locked = TRUE,
        lock_reason = EXCLUDED.lock_reason,
        duress_flag = EXCLUDED.duress_flag,
        locked_at = NOW(),
        requires_reauth = TRUE,
        updated_at = NOW()
    RETURNING * INTO v_lock;

    RETURN v_lock;
END;
$$;

-- Unlocks escrow for a user after successful re-authentication
CREATE OR REPLACE FUNCTION public.unlock_user_escrow(
    p_user_id UUID
)
RETURNS public.escrow_locks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock public.escrow_locks;
BEGIN
    UPDATE public.escrow_locks
    SET is_locked = FALSE,
        unlocked_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_lock;

    IF v_lock.user_id IS NULL THEN
        INSERT INTO public.escrow_locks (user_id, is_locked, lock_reason, duress_flag, unlocked_at, requires_reauth)
        VALUES (p_user_id, FALSE, NULL, FALSE, NOW(), FALSE)
        RETURNING * INTO v_lock;
    END IF;

    RETURN v_lock;
END;
$$;

-- Records a safety alert (audit trail for anomalies & duress)
CREATE OR REPLACE FUNCTION public.record_safety_alert(
    p_user_id UUID,
    p_alert_type TEXT,
    p_confidence_score REAL DEFAULT NULL,
    p_sensor_snapshot JSONB DEFAULT NULL,
    p_locked_escrow BOOLEAN DEFAULT FALSE,
    p_duress_indicated BOOLEAN DEFAULT FALSE,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alert public.safety_alerts;
BEGIN
    INSERT INTO public.safety_alerts (
        user_id, alert_type, confidence_score, sensor_snapshot,
        locked_escrow, duress_indicated, ip_address, user_agent
    )
    VALUES (
        p_user_id, p_alert_type, p_confidence_score, p_sensor_snapshot,
        p_locked_escrow, p_duress_indicated, p_ip_address, p_user_agent
    )
    RETURNING * INTO v_alert;

    RETURN v_alert;
END;
$$;

-- Upserts a kinematic profile baseline
CREATE OR REPLACE FUNCTION public.upsert_kinematic_profile(
    p_user_id UUID,
    p_baseline JSONB,
    p_model_version TEXT DEFAULT NULL,
    p_threshold REAL DEFAULT NULL,
    p_calibration_count INTEGER DEFAULT 1
)
RETURNS public.kinematic_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile public.kinematic_profiles;
BEGIN
    INSERT INTO public.kinematic_profiles (
        user_id, baseline, model_version, threshold, calibration_count, last_calibrated_at
    )
    VALUES (
        p_user_id, p_baseline, p_model_version, p_threshold, p_calibration_count, NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        baseline = EXCLUDED.baseline,
        model_version = COALESCE(EXCLUDED.model_version, public.kinematic_profiles.model_version),
        threshold = COALESCE(EXCLUDED.threshold, public.kinematic_profiles.threshold),
        calibration_count = public.kinematic_profiles.calibration_count + 1,
        last_calibrated_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$;

-- ============================================================
-- 10. AUTO-UPDATED_AT TRIGGER (mirrors existing pattern)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        DROP TRIGGER IF EXISTS escrow_locks_updated_at ON public.escrow_locks;
        CREATE TRIGGER escrow_locks_updated_at
            BEFORE UPDATE ON public.escrow_locks
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        DROP TRIGGER IF EXISTS kinematic_profiles_updated_at ON public.kinematic_profiles;
        CREATE TRIGGER kinematic_profiles_updated_at
            BEFORE UPDATE ON public.kinematic_profiles
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- ============================================================
-- 11. REALTIME PUBLICATION
--    Users subscribe to lock state changes across tabs.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_alerts;

-- ============================================================
-- 12. AUDIT TRAIL NOTE
-- ============================================================
COMMENT ON TABLE public.safety_alerts IS
    'Audit log of continuous-authentication anomaly detections, duress triggers, and escrow locks.';
COMMENT ON TABLE public.escrow_locks IS
    'Tracks the lock state of the escrow ledger. Locked automatically on kinematic anomaly detection.';
COMMENT ON TABLE public.kinematic_profiles IS
    'Baseline kinematic signature used by the continuous authentication anomaly detector.';
