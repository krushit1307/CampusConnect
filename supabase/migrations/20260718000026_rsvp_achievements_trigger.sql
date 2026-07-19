-- Database Trigger to Track Profile Achievement Progress

CREATE OR REPLACE FUNCTION public.check_rsvp_achievements()
RETURNS TRIGGER AS $$
DECLARE
    rsvp_count INTEGER;
    achievement_uuid UUID;
BEGIN
    -- Count total active RSVPs for the user
    SELECT COUNT(*) INTO rsvp_count
    FROM public.event_rsvps
    WHERE user_id = NEW.user_id;

    -- If count is exactly 1, this is their first RSVP
    IF rsvp_count = 1 THEN
        -- Look up the 'First RSVP' achievement ID
        SELECT id INTO achievement_uuid
        FROM public.achievements
        WHERE title = 'First RSVP'
        LIMIT 1;

        -- If the achievement exists, grant it
        IF achievement_uuid IS NOT NULL THEN
            INSERT INTO public.profile_achievements (profile_id, achievement_id)
            VALUES (NEW.user_id, achievement_uuid)
            ON CONFLICT (profile_id, achievement_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire AFTER INSERT on event_rsvps
DROP TRIGGER IF EXISTS trg_check_rsvp_achievements ON public.event_rsvps;

CREATE TRIGGER trg_check_rsvp_achievements
AFTER INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_rsvp_achievements();
