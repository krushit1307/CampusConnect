-- ============================================================
-- Migration: 20260829000004_content_moderation.sql
-- Issue: #5359 - Automated "Profanity/Harassment" Automated Deepfake Pornography Detection (Hash Matching)
-- Description:
--   1. Create content_moderation_queue table for upload screening
--   2. Create content_hashes table for perceptual hash storage
--   3. Create forensic_reports table for law enforcement reporting
--   4. Create user_suspensions table for account freezing
--   5. Create RPC functions for content screening and account freezing
--   6. Create forensic reporting functions
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create content_moderation_queue table
CREATE TABLE IF NOT EXISTS public.content_moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL UNIQUE, -- Temporary ID for the upload
    file_name TEXT NOT NULL,
    file_size_bytes INT NOT NULL,
    content_type TEXT NOT NULL,
    bucket TEXT NOT NULL,
    path TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    upload_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    screening_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (screening_status IN ('pending', 'screening', 'approved', 'rejected', 'error')),
    screening_started_at TIMESTAMPTZ,
    screening_completed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    match_database TEXT, -- NCMEC, StopNCII, etc.
    match_score NUMERIC(5, 2),
    is_hash_match BOOLEAN DEFAULT FALSE,
    is_deepfake_detected BOOLEAN DEFAULT FALSE,
    is_csam_detected BOOLEAN DEFAULT FALSE,
    telemetry_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_user_id ON public.content_moderation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_status ON public.content_moderation_queue(screening_status);
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_upload_id ON public.content_moderation_queue(upload_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_queue_timestamp ON public.content_moderation_queue(upload_timestamp DESC);

-- 2. Create content_hashes table
CREATE TABLE IF NOT EXISTS public.content_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_queue_id UUID NOT NULL REFERENCES public.content_moderation_queue(id) ON DELETE CASCADE,
    hash_algorithm TEXT NOT NULL
        CHECK (hash_algorithm IN ('photodna', 'pHash', 'dHash', 'cnn_hash', 'md5', 'sha256')),
    hash_value TEXT NOT NULL,
    hash_length INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_hash_value_not_empty CHECK (LENGTH(hash_value) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_hashes_moderation_queue_id ON public.content_hashes(moderation_queue_id);
CREATE INDEX IF NOT EXISTS idx_content_hashes_hash_value ON public.content_hashes(hash_value);
CREATE INDEX IF NOT EXISTS idx_content_hashes_algorithm ON public.content_hashes(hash_algorithm);

-- 3. Create forensic_reports table
CREATE TABLE IF NOT EXISTS public.forensic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_queue_id UUID NOT NULL REFERENCES public.content_moderation_queue(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL
        CHECK (report_type IN ('csam', 'ncii', 'deepfake', 'harassment', 'other')),
    severity TEXT NOT NULL DEFAULT 'critical'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    report_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (report_status IN ('pending', 'submitted', 'acknowledged', 'resolved')),
    
    -- User telemetry
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    location_data JSONB,
    
    -- Content information
    file_name TEXT,
    file_size_bytes INT,
    content_type TEXT,
    hash_values JSONB,
    match_details JSONB,
    
    -- Legal/forensic information
    incident_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_submitted_at TIMESTAMPTZ,
    report_submitted_to TEXT[], -- NCMEC, Campus Police, FBI, etc.
    case_number TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forensic_reports_moderation_queue_id ON public.forensic_reports(moderation_queue_id);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_user_id ON public.forensic_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_status ON public.forensic_reports(report_status);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_type ON public.forensic_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_forensic_reports_severity ON public.forensic_reports(severity);

-- 4. Create user_suspensions table
CREATE TABLE IF NOT EXISTS public.user_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    suspension_type TEXT NOT NULL
        CHECK (suspension_type IN ('content_violation', 'csam', 'harassment', 'deepfake', 'fraud', 'other')),
    severity TEXT NOT NULL DEFAULT 'high'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    suspension_status TEXT NOT NULL DEFAULT 'active'
        CHECK (suspension_status IN ('active', 'lifted', 'permanent')),
    
    -- Suspension details
    reason TEXT NOT NULL,
    evidence_data JSONB,
    forensic_report_id UUID REFERENCES public.forensic_reports(id) ON DELETE SET NULL,
    
    -- Timeline
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    lifted_at TIMESTAMPTZ,
    lifted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    lift_reason TEXT,
    
    -- Permanent suspension
    is_permanent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_suspension_timeline CHECK (
        (suspension_status = 'active' AND lifted_at IS NULL) OR
        (suspension_status = 'lifted' AND lifted_at IS NOT NULL) OR
        (suspension_status = 'permanent' AND is_permanent = TRUE)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON public.user_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_status ON public.user_suspensions(suspension_status);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_type ON public.user_suspensions(suspension_type);

-- 5. Enable RLS
ALTER TABLE public.content_moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_moderation_queue
CREATE POLICY "Service role can manage moderation queue" ON public.content_moderation_queue
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view moderation queue" ON public.content_moderation_queue
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for content_hashes
CREATE POLICY "Service role can manage content hashes" ON public.content_hashes
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view content hashes" ON public.content_hashes
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for forensic_reports
CREATE POLICY "Service role can manage forensic reports" ON public.forensic_reports
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view forensic reports" ON public.forensic_reports
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update forensic reports" ON public.forensic_reports
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for user_suspensions
CREATE POLICY "Service role can manage user suspensions" ON public.user_suspensions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view user suspensions" ON public.user_suspensions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update user suspensions" ON public.user_suspensions
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 6. Create function to create moderation queue entry
CREATE OR REPLACE FUNCTION public.create_moderation_queue_entry(
    p_user_id UUID,
    p_upload_id UUID,
    p_file_name TEXT,
    p_file_size_bytes INT,
    p_content_type TEXT,
    p_bucket TEXT,
    p_path TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    INSERT INTO public.content_moderation_queue (
        user_id, upload_id, file_name, file_size_bytes, content_type,
        bucket, path, ip_address, user_agent
    ) VALUES (
        p_user_id, p_upload_id, p_file_name, p_file_size_bytes, p_content_type,
        p_bucket, p_path, p_ip_address, p_user_agent
    ) RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$;

-- 7. Create function to store content hash
CREATE OR REPLACE FUNCTION public.store_content_hash(
    p_moderation_queue_id UUID,
    p_hash_algorithm TEXT,
    p_hash_value TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash_id UUID;
BEGIN
    INSERT INTO public.content_hashes (
        moderation_queue_id, hash_algorithm, hash_value, hash_length
    ) VALUES (
        p_moderation_queue_id, p_hash_algorithm, p_hash_value, LENGTH(p_hash_value)
    ) RETURNING id INTO v_hash_id;
    
    RETURN v_hash_id;
END;
$$;

-- 8. Create function to reject content
CREATE OR REPLACE FUNCTION public.reject_content(
    p_moderation_queue_id UUID,
    p_rejection_reason TEXT,
    p_match_database TEXT DEFAULT NULL,
    p_match_score NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_queue RECORD;
BEGIN
    -- Update moderation queue
    UPDATE public.content_moderation_queue
    SET 
        screening_status = 'rejected',
        screening_completed_at = NOW(),
        rejection_reason = p_rejection_reason,
        match_database = p_match_database,
        match_score = p_match_score,
        is_hash_match = (p_match_database IS NOT NULL)
    WHERE id = p_moderation_queue_id;
    
    -- Get queue details for forensic report
    SELECT * INTO v_queue
    FROM public.content_moderation_queue
    WHERE id = p_moderation_queue_id;
    
    -- Create forensic report for critical violations
    IF p_match_database IN ('NCMEC', 'StopNCII') OR p_rejection_reason LIKE '%CSAM%' OR p_rejection_reason LIKE '%deepfake%' THEN
        INSERT INTO public.forensic_reports (
            moderation_queue_id, user_id, report_type, severity,
            ip_address, user_agent, file_name, file_size_bytes, content_type
        ) VALUES (
            p_moderation_queue_id, v_queue.user_id,
            CASE 
                WHEN p_match_database = 'NCMEC' THEN 'csam'
                WHEN p_match_database = 'StopNCII' THEN 'ncii'
                WHEN p_rejection_reason LIKE '%deepfake%' THEN 'deepfake'
                ELSE 'other'
            END,
            'critical',
            v_queue.ip_address, v_queue.user_agent, v_queue.file_name,
            v_queue.file_size_bytes, v_queue.content_type
        );
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 9. Create function to approve content
CREATE OR REPLACE FUNCTION public.approve_content(
    p_moderation_queue_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.content_moderation_queue
    SET 
        screening_status = 'approved',
        screening_completed_at = NOW()
    WHERE id = p_moderation_queue_id;
    
    RETURN TRUE;
END;
$$;

-- 10. Create function to suspend user
CREATE OR REPLACE FUNCTION public.suspend_user(
    p_user_id UUID,
    p_suspension_type TEXT,
    p_reason TEXT,
    p_severity TEXT DEFAULT 'high',
    p_is_permanent BOOLEAN DEFAULT FALSE,
    p_forensic_report_id UUID DEFAULT NULL,
    p_suspended_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_suspension_id UUID;
BEGIN
    INSERT INTO public.user_suspensions (
        user_id, suspension_type, severity, reason, is_permanent,
        forensic_report_id, suspended_by, suspension_status
    ) VALUES (
        p_user_id, p_suspension_type, p_severity, p_reason, p_is_permanent,
        p_forensic_report_id, p_suspended_by, 
        CASE WHEN p_is_permanent THEN 'permanent' ELSE 'active' END
    ) RETURNING id INTO v_suspension_id;
    
    RETURN v_suspension_id;
END;
$$;

-- 11. Create function to check if user is suspended
CREATE OR REPLACE FUNCTION public.is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_suspended BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_suspensions
        WHERE user_id = p_user_id
          AND suspension_status = 'active'
    ) INTO v_is_suspended;
    
    RETURN v_is_suspended;
END;
$$;

-- 12. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_moderation_queue_entry(UUID, UUID, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_content_hash(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_content(UUID, TEXT, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_content(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.suspend_user(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_suspended(UUID) TO authenticated;
