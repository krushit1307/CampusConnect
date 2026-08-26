-- Trigger function to award gamification points when a referred user attends their first event
CREATE OR REPLACE FUNCTION award_referral_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_referrer_id UUID;
    v_has_been_rewarded BOOLEAN;
    v_attended_count INTEGER;
BEGIN
    -- Only process if status changed TO 'attended'
    IF NEW.status = 'attended' AND (OLD.status IS NULL OR OLD.status <> 'attended') THEN
        
        -- 1. Check if the user was referred and hasn't been rewarded yet
        SELECT referred_by_id, referral_rewarded
        INTO v_referrer_id, v_has_been_rewarded
        FROM profiles
        WHERE id = NEW.user_id;

        -- If they have no referrer, or they've already been rewarded, skip
        IF v_referrer_id IS NULL OR v_has_been_rewarded = TRUE THEN
            RETURN NEW;
        END IF;

        -- 2. Verify this is their FIRST attendance
        SELECT COUNT(*)
        INTO v_attended_count
        FROM event_rsvps
        WHERE user_id = NEW.user_id AND status = 'attended';

        -- Since we run AFTER UPDATE, count should be exactly 1
        IF v_attended_count = 1 THEN
            
            -- Reward Referrer
            INSERT INTO gamification_points (user_id, points, reason)
            VALUES (v_referrer_id, 500, 'referral_attendance');

            -- Reward New User
            INSERT INTO gamification_points (user_id, points, reason)
            VALUES (NEW.user_id, 500, 'first_attendance_referral');

            -- Log Reward
            INSERT INTO referral_rewards (referrer_id, referred_user_id, points_awarded, event_id)
            VALUES (v_referrer_id, NEW.user_id, 500, NEW.event_id)
            ON CONFLICT (referred_user_id) DO NOTHING;

            -- Mark as rewarded
            UPDATE profiles
            SET referral_rewarded = TRUE
            WHERE id = NEW.user_id;

        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_reward ON event_rsvps;
CREATE TRIGGER trg_referral_reward
AFTER UPDATE ON event_rsvps
FOR EACH ROW
EXECUTE FUNCTION award_referral_points();
