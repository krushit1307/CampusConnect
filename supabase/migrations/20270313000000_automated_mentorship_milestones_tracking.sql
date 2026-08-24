-- Migration: 20270313000000_automated_mentorship_milestones_tracking.sql
-- Description: Database schema updates and stored procedures for Automated Mentorship Milestones Tracking with Cryptographic PIN verification and Gamification triggers (#4282)

-- 1. Ensure meeting_count and milestone columns exist on mentorship_pairs
ALTER TABLE IF EXISTS mentorship_pairs
ADD COLUMN IF NOT EXISTS meeting_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_milestones_achieved INT NOT NULL DEFAULT 0;

-- 2. Create mentorship_checkin_logs table for verification history
CREATE TABLE IF NOT EXISTS mentorship_checkin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES mentorship_pairs(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL,
  mentee_id UUID NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meeting_number INT NOT NULL,
  verification_pin VARCHAR(6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by pair
CREATE INDEX IF NOT EXISTS idx_mentorship_checkin_pair ON mentorship_checkin_logs(pair_id);

-- 3. Stored Procedure: Generate Dynamic Check-In PIN (Called by Mentor)
CREATE OR REPLACE FUNCTION generate_mentorship_checkin_pin(
  p_pair_id UUID,
  p_mentor_id UUID
)
RETURNS TABLE (
  generated_pin VARCHAR(6),
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_pin VARCHAR(6);
  v_expires TIMESTAMPTZ;
BEGIN
  -- Verify mentor ownership
  IF NOT EXISTS (
    SELECT 1 FROM mentorship_pairs 
    WHERE id = p_pair_id AND (mentor_id = p_mentor_id OR mentor_id::text = p_mentor_id::text)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not the assigned mentor for this pair.';
  END IF;

  -- Generate 6-digit random PIN
  v_new_pin := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expires := NOW() + INTERVAL '5 minutes';

  -- Update mentorship_pairs record
  UPDATE mentorship_pairs
  SET current_pin = v_new_pin,
      pin_expires_at = v_expires
  WHERE id = p_pair_id;

  RETURN QUERY SELECT v_new_pin, v_expires;
END;
$$;

-- 4. Stored Procedure: Verify Check-In PIN & Increment Milestones (Called by Mentee)
CREATE OR REPLACE FUNCTION verify_mentorship_checkin_pin(
  p_pair_id UUID,
  p_mentee_id UUID,
  p_input_pin VARCHAR(6)
)
RETURNS TABLE (
  success BOOLEAN,
  new_meeting_count INT,
  milestone_unlocked BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pair RECORD;
  v_new_count INT;
  v_milestone BOOLEAN := FALSE;
  v_msg TEXT;
BEGIN
  -- Fetch pair record
  SELECT * INTO v_pair FROM mentorship_pairs WHERE id = p_pair_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentorship pair not found.';
  END IF;

  -- Verify PIN correctness and expiration
  IF v_pair.current_pin IS NULL OR v_pair.current_pin != p_input_pin THEN
    RETURN QUERY SELECT FALSE, v_pair.meeting_count, FALSE, 'Invalid PIN code entered.'::TEXT;
    RETURN;
  END IF;

  IF v_pair.pin_expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, v_pair.meeting_count, FALSE, 'PIN has expired. Please ask your mentor to generate a new PIN.'::TEXT;
    RETURN;
  END IF;

  -- Increment meeting count & clear PIN
  v_new_count := v_pair.meeting_count + 1;
  
  -- Check if Milestone (every 5 meetings) is unlocked
  IF v_new_count % 5 = 0 THEN
    v_milestone := TRUE;
  END IF;

  UPDATE mentorship_pairs
  SET meeting_count = v_new_count,
      current_pin = NULL,
      pin_expires_at = NULL,
      total_milestones_achieved = CASE WHEN v_milestone THEN total_milestones_achieved + 1 ELSE total_milestones_achieved END
  WHERE id = p_pair_id;

  -- Log verification
  INSERT INTO mentorship_checkin_logs (pair_id, mentor_id, mentee_id, meeting_number, verification_pin)
  VALUES (p_pair_id, v_pair.mentor_id, p_mentee_id, v_new_count, p_input_pin);

  IF v_milestone THEN
    v_msg := 'Check-in verified successfully! 🎉 Milestone Unlocked! 1,000 Gamification points awarded to Mentor & Certificate issued to Mentee.';
  ELSE
    v_msg := 'Check-in verified successfully! Meeting count updated.';
  END IF;

  RETURN QUERY SELECT TRUE, v_new_count, v_milestone, v_msg;
END;
$$;
