-- Migration: 20270830000000_event_photo_bounties.sql
-- Description: Implement 'Automated "Missing Photo" Bounties' (#4531)

-- 1. Add photo_status and photo_status_updated_at columns to events table if missing
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS photo_status VARCHAR(50) DEFAULT 'Pending' CHECK (photo_status IN ('Pending', 'Escalated', 'Bounty_Active', 'Completed'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS photo_status_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- 2. Create trigger to update photo_status_updated_at timestamp on change
CREATE OR REPLACE FUNCTION public.update_photo_status_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.photo_status IS DISTINCT FROM NEW.photo_status THEN
        NEW.photo_status_updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_photo_status_timestamp ON public.events;
CREATE TRIGGER trg_update_photo_status_timestamp
BEFORE UPDATE OF photo_status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_photo_status_timestamp();

-- 3. Create event_photo_bounty_winners table
CREATE TABLE IF NOT EXISTS public.event_photo_bounty_winners (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_photo_bounty_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view photo bounty winners" ON public.event_photo_bounty_winners;
CREATE POLICY "Anyone can view photo bounty winners" 
ON public.event_photo_bounty_winners FOR SELECT 
USING (true);

-- 4. Trigger function to check photo bounty completion on new photo upload
CREATE OR REPLACE FUNCTION public.check_photo_bounty_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_photo_status VARCHAR(50);
    v_event_title TEXT;
    v_user_photo_count INT;
    v_winner_count INT;
    v_already_won BOOLEAN;
    v_points_ledger_exists BOOLEAN;
BEGIN
    -- Get event photo status and title
    SELECT photo_status, title 
    INTO v_photo_status, v_event_title
    FROM public.events
    WHERE id = NEW.event_id;

    -- Only proceed if bounty is active
    IF v_photo_status = 'Bounty_Active' THEN
        -- Check if user has already won this bounty
        SELECT EXISTS (
            SELECT 1 FROM public.event_photo_bounty_winners
            WHERE event_id = NEW.event_id AND user_id = NEW.user_id
        ) INTO v_already_won;

        IF NOT v_already_won THEN
            -- Count photos uploaded by this user for this event
            SELECT COUNT(*) INTO v_user_photo_count
            FROM public.event_photos
            WHERE event_id = NEW.event_id AND user_id = NEW.user_id;

            -- Check if they have reached the threshold of 5 photos
            IF v_user_photo_count >= 5 THEN
                -- Check how many winners we have so far
                SELECT COUNT(*) INTO v_winner_count
                FROM public.event_photo_bounty_winners
                WHERE event_id = NEW.event_id;

                IF v_winner_count < 3 THEN
                    -- Insert user as winner
                    INSERT INTO public.event_photo_bounty_winners (event_id, user_id)
                    VALUES (NEW.event_id, NEW.user_id)
                    ON CONFLICT DO NOTHING;

                    -- Check if insert succeeded
                    IF FOUND THEN
                        -- Award points
                        UPDATE public.profiles
                        SET gamification_points = gamification_points + 500
                        WHERE id = NEW.user_id;

                        -- Check if points_ledger table exists (robustness)
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'points_ledger'
                        ) INTO v_points_ledger_exists;

                        IF v_points_ledger_exists THEN
                            INSERT INTO public.points_ledger (user_id, amount, reason)
                            VALUES (
                                NEW.user_id,
                                500,
                                'Photo Bounty Winner for Event: ' || v_event_title
                            );
                        END IF;

                        -- Notify the winner
                        INSERT INTO public.notifications (user_id, type, title, message, link)
                        VALUES (
                            NEW.user_id,
                            'system',
                            'Bounty Claimed!',
                            'Congratulations! You are one of the first to upload 5 photos for "' || v_event_title || '" and have received 500 Gamification Points.',
                            '/events/' || NEW.event_id || '/album'
                        );

                        -- Recount winners
                        SELECT COUNT(*) INTO v_winner_count
                        FROM public.event_photo_bounty_winners
                        WHERE event_id = NEW.event_id;

                        -- If we reached 3 winners, close the bounty
                        IF v_winner_count >= 3 THEN
                            UPDATE public.events
                            SET photo_status = 'Completed'
                            WHERE id = NEW.event_id;

                            -- Notify remaining attendees that the bounty is closed
                            INSERT INTO public.notifications (user_id, type, title, message, link)
                            SELECT 
                                user_id,
                                'event',
                                'Photo Bounty Closed',
                                'The photo bounty for "' || v_event_title || '" has been closed as 3 attendees have successfully claimed the rewards.',
                                '/events/' || NEW.event_id || '/album'
                            FROM public.event_rsvps
                            WHERE event_id = NEW.event_id AND checked_in = TRUE;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_photo_bounty_completion ON public.event_photos;
CREATE TRIGGER trg_check_photo_bounty_completion
AFTER INSERT ON public.event_photos
FOR EACH ROW
EXECUTE FUNCTION public.check_photo_bounty_completion();

-- 5. Function to escalate and activate photo bounties after 7 days
CREATE OR REPLACE FUNCTION public.check_and_activate_photo_bounties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event RECORD;
BEGIN
    -- Find events where photo_status = 'Escalated' and the status has been Escalated for > 7 days
    FOR v_event IN
        SELECT id, title
        FROM public.events
        WHERE photo_status = 'Escalated'
          AND photo_status_updated_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Transition status to 'Bounty_Active'
        UPDATE public.events
        SET photo_status = 'Bounty_Active'
        WHERE id = v_event.id;

        -- Dispatch push notifications to all verified attendees (checked_in = TRUE)
        INSERT INTO public.notifications (user_id, type, title, message, link)
        SELECT 
            user_id,
            'event',
            'Photo Bounty Active!',
            'Photo Bounty! The first 3 people to upload 5 high-quality photos from "' || v_event.title || '" will receive 500 Gamification Points!',
            '/events/' || v_event.id || '/album'
        FROM public.event_rsvps
        WHERE event_id = v_event.id AND checked_in = TRUE;
    END LOOP;
END;
$$;
