-- Migration for rate limiting RSVP toggles
CREATE TABLE IF NOT EXISTS public.rsvp_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger function to enforce rate limit
CREATE OR REPLACE FUNCTION check_rsvp_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INT;
    uid UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        uid := OLD.user_id;
    ELSE
        uid := NEW.user_id;
    END IF;

    -- Check recent toggles by this user
    SELECT COUNT(*) INTO recent_count
    FROM public.rsvp_activity_log
    WHERE user_id = uid AND created_at > NOW() - INTERVAL '1 minute';

    IF recent_count >= 5 THEN
        RAISE EXCEPTION 'Rate limit exceeded: too many RSVP actions. Please wait a minute.';
    END IF;

    -- Log this action
    INSERT INTO public.rsvp_activity_log (user_id, action) VALUES (uid, TG_OP);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_rsvp_rate_limit
BEFORE INSERT OR DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION check_rsvp_rate_limit();
