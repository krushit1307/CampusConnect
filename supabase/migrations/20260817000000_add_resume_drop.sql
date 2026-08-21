-- Migration: Add Resume Drop feature (Issue #2872)

-- 1. Add is_resume_required to events
ALTER TABLE public.events
    ADD COLUMN is_resume_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add resume_path to event_rsvps
ALTER TABLE public.event_rsvps
    ADD COLUMN resume_path TEXT;

-- 3. Create event_sponsors table
CREATE TABLE IF NOT EXISTS public.event_sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Enable RLS on event_sponsors
ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

-- Admins/organizers can manage sponsors (assuming verified club admin/event owner has access, for now we will rely on basic read access for sponsors themselves)
CREATE POLICY "Sponsors can view their own sponsorship"
    ON public.event_sponsors FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Event creators can manage sponsors"
    ON public.event_sponsors FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id AND e.created_by = auth.uid()
        )
    );

-- 4. Update get_event_rsvp_state to return is_resume_required
CREATE OR REPLACE FUNCTION public.get_event_rsvp_state(
    p_event_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_is_resume_required BOOLEAN;
    v_attending_count INTEGER;
    v_waitlist_count INTEGER;
    v_user_status TEXT;
    v_user_position INTEGER;
BEGIN
    SELECT max_attendees, is_resume_required
    INTO v_max_attendees, v_is_resume_required
    FROM public.events
    WHERE id = p_event_id;

    SELECT COUNT(*) FILTER (WHERE status = 'attending')
    INTO v_attending_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id;

    SELECT COUNT(*) FILTER (WHERE status = 'waitlisted')
    INTO v_waitlist_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id;

    IF p_user_id IS NOT NULL THEN
        SELECT status
        INTO v_user_status
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
        LIMIT 1;

        IF v_user_status = 'waitlisted' THEN
            SELECT COUNT(*) + 1
            INTO v_user_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at < (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'max_attendees', v_max_attendees,
        'is_resume_required', v_is_resume_required,
        'attending_count', v_attending_count,
        'waitlist_count', v_waitlist_count,
        'is_full', v_max_attendees IS NOT NULL AND v_attending_count >= v_max_attendees,
        'user_status', v_user_status,
        'user_waitlist_position', v_user_position
    );
END;
 $$;

-- 5. Update join_event_or_waitlist to handle resume_path
CREATE OR REPLACE FUNCTION public.join_event_or_waitlist(
    p_event_id UUID,
    p_user_id UUID,
    p_resume_path TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_max_attendees INTEGER;
    v_is_resume_required BOOLEAN;
    v_current_attending INTEGER;
    v_existing_status TEXT;
    v_waitlist_position INTEGER;
BEGIN
    -- ── Lock the event row to serialise concurrent joins ────────
    SELECT max_attendees, is_resume_required
    INTO v_max_attendees, v_is_resume_required
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Event not found.'
        );
    END IF;

    IF v_is_resume_required AND p_resume_path IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A resume is required to RSVP for this event.'
        );
    END IF;

    -- ── Check for an existing RSVP by this user ─────────────────
    SELECT status
    INTO v_existing_status
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_existing_status = 'attending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending',
            'message', 'Already RSVPed as attending.'
        );
    END IF;

    IF v_existing_status = 'waitlisted' THEN
        SELECT COUNT(*) + 1
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at < (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;

    -- ── If user had previously cancelled, reactivate ────────────
    IF v_existing_status = 'cancelled' THEN
        PERFORM 1
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND user_id = p_user_id
          AND status = 'cancelled'
        FOR UPDATE;

        SELECT COUNT(*)
        INTO v_current_attending
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'attending';

        IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
            UPDATE public.event_rsvps
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE, resume_path = COALESCE(p_resume_path, resume_path)
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            RETURN jsonb_build_object(
                'success', true,
                'status', 'attending'
            );
        ELSE
            UPDATE public.event_rsvps
            SET status = 'waitlisted', rsvp_at = NOW(), resume_path = COALESCE(p_resume_path, resume_path)
            WHERE event_id = p_event_id
              AND user_id = p_user_id
              AND status = 'cancelled';
            SELECT COUNT(*)
            INTO v_waitlist_position
            FROM public.event_rsvps
            WHERE event_id = p_event_id
              AND status = 'waitlisted'
              AND rsvp_at <= (
                  SELECT rsvp_at FROM public.event_rsvps
                  WHERE event_id = p_event_id AND user_id = p_user_id
                  LIMIT 1
              );
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waitlisted',
                'position', v_waitlist_position
            );
        END IF;
    END IF;

    -- ── New RSVP: insert as attending or waitlisted ────────────
    SELECT COUNT(*)
    INTO v_current_attending
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND status = 'attending';

    IF v_max_attendees IS NULL OR v_current_attending < v_max_attendees THEN
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, resume_path)
        VALUES (p_event_id, p_user_id, 'attending', NOW(), p_resume_path)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'attending', rsvp_at = NOW(), checked_in = FALSE, resume_path = COALESCE(p_resume_path, EXCLUDED.resume_path);
        RETURN jsonb_build_object(
            'success', true,
            'status', 'attending'
        );
    ELSE
        INSERT INTO public.event_rsvps (event_id, user_id, status, rsvp_at, resume_path)
        VALUES (p_event_id, p_user_id, 'waitlisted', NOW(), p_resume_path)
        ON CONFLICT (event_id, user_id) DO UPDATE
            SET status = 'waitlisted', rsvp_at = NOW(), resume_path = COALESCE(p_resume_path, EXCLUDED.resume_path);
        SELECT COUNT(*)
        INTO v_waitlist_position
        FROM public.event_rsvps
        WHERE event_id = p_event_id
          AND status = 'waitlisted'
          AND rsvp_at <= (
              SELECT rsvp_at FROM public.event_rsvps
              WHERE event_id = p_event_id AND user_id = p_user_id
              LIMIT 1
          );
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waitlisted',
            'position', v_waitlist_position
        );
    END IF;
END;
 $$;

-- 6. Setup resumes bucket and RLS policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 2097152, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE SET 
    public = false, 
    file_size_limit = 2097152, 
    allowed_mime_types = ARRAY['application/pdf']::text[];

-- Policy: Users can upload their own resume for an event
-- Path format: {event_id}/{user_id}/{filename}
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can read their own resume
CREATE POLICY "Users can read their own resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can update their own resume
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE
TO authenticated
WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own resume
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Verified sponsors can read resumes for their events
CREATE POLICY "Event sponsors can read event resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resumes' AND
    EXISTS (
        SELECT 1 FROM public.event_sponsors
        WHERE event_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
    )
);

-- Policy: Event creators can read resumes for their events
CREATE POLICY "Event creators can read event resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resumes' AND
    EXISTS (
        SELECT 1 FROM public.events
        WHERE id::text = (storage.foldername(name))[1]
        AND created_by = auth.uid()
    )
);
