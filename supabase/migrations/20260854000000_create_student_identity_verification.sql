-- 1. Add verification flags to user profiles
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Create student_otp_verifications table
CREATE TABLE IF NOT EXISTS student_otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts_remaining INTEGER DEFAULT 3 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- Index for expiration lookups
CREATE INDEX IF NOT EXISTS idx_otp_verification_user ON student_otp_verifications(user_id);

-- Enable RLS on sensitive tables
ALTER TABLE student_otp_verifications ENABLE ROW LEVEL SECURITY;

-- 3. Stored RPC function to verify OTP and activate student account
CREATE OR REPLACE FUNCTION verify_student_otp(
    p_user_id UUID,
    p_input_otp TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM student_otp_verifications WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check expiration & attempt bounds
    IF NOW() > v_rec.expires_at OR v_rec.attempts_remaining <= 0 THEN
        DELETE FROM student_otp_verifications WHERE user_id = p_user_id;
        RETURN FALSE;
    END IF;

    -- Verify hash match (SHA-256 equivalent in PL/pgSQL)
    IF v_rec.otp_hash = encode(digest(p_input_otp, 'sha256'), 'hex') THEN
        UPDATE user_preferences
        SET is_verified = TRUE, verified_at = NOW()
        WHERE user_id = p_user_id;

        DELETE FROM student_otp_verifications WHERE user_id = p_user_id;
        RETURN TRUE;
    ELSE
        UPDATE student_otp_verifications
        SET attempts_remaining = attempts_remaining - 1
        WHERE user_id = p_user_id;
        
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;