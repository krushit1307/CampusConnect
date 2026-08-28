-- Migration: 20270827000000_hardware_resource_queue.sql
-- Description: Develop a 'Dynamic "Hardware Resource" Reservation Queue' (#4515)

-- 1. Ensure columns exist on resource_bookings
ALTER TABLE public.resource_bookings ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.resource_bookings ADD COLUMN IF NOT EXISTS organizer_club_name VARCHAR(255);

-- 2. Dynamically create resource_waitlists table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'university_resources') THEN
        CREATE TABLE IF NOT EXISTS public.resource_waitlists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource_id UUID NOT NULL REFERENCES public.university_resources(id) ON DELETE CASCADE,
            club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
            requested_start TIMESTAMPTZ NOT NULL,
            requested_end TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT check_waitlist_times CHECK (requested_end > requested_start)
        );
    ELSE
        CREATE TABLE IF NOT EXISTS public.resource_waitlists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
            club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
            requested_start TIMESTAMPTZ NOT NULL,
            requested_end TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT check_waitlist_times CHECK (requested_end > requested_start)
        );
    END IF;
END $$;

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_resource_waitlists_lookup ON public.resource_waitlists(resource_id, created_at ASC);

-- 4. Enable RLS
ALTER TABLE public.resource_waitlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view resource waitlist" ON public.resource_waitlists;
CREATE POLICY "Anyone can view resource waitlist" 
ON public.resource_waitlists FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Club admins can manage waitlist entries for their club" ON public.resource_waitlists;
CREATE POLICY "Club admins can manage waitlist entries for their club" 
ON public.resource_waitlists FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = resource_waitlists.club_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'::public.member_role
          AND cm.status = 'approved'::public.join_status
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = resource_waitlists.club_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'::public.member_role
          AND cm.status = 'approved'::public.join_status
    )
);

-- 5. Trigger function to promote waitlist on booking cancellation or modification
CREATE OR REPLACE FUNCTION public.process_resource_waitlist_on_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_waitlist_record RECORD;
    v_resource_name TEXT;
    v_club_name TEXT;
    v_conflict_exists BOOLEAN;
BEGIN
    -- Only trigger if:
    -- 1. A booking was deleted and it was CONFIRMED or APPROVED
    -- 2. A booking was updated, and either:
    --    - Its status changed from CONFIRMED or APPROVED to something else
    --    - Its times start_time/end_time changed
    --    - Its resource_id changed
    IF (TG_OP = 'DELETE' AND (OLD.status = 'CONFIRMED' OR OLD.status = 'APPROVED')) OR
       (TG_OP = 'UPDATE' AND (
           ((OLD.status = 'CONFIRMED' OR OLD.status = 'APPROVED') AND (NEW.status IS DISTINCT FROM 'CONFIRMED' AND NEW.status IS DISTINCT FROM 'APPROVED')) OR
           (OLD.start_time IS DISTINCT FROM NEW.start_time) OR
           (OLD.end_time IS DISTINCT FROM NEW.end_time) OR
           (OLD.resource_id IS DISTINCT FROM NEW.resource_id)
       ))
    THEN
        -- Get resource name from university_resources or resources
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'university_resources') THEN
            SELECT name INTO v_resource_name 
            FROM public.university_resources 
            WHERE id = COALESCE(OLD.resource_id, NEW.resource_id);
        ELSE
            SELECT name INTO v_resource_name 
            FROM public.resources 
            WHERE id = COALESCE(OLD.resource_id, NEW.resource_id);
        END IF;

        -- Loop through the waitlist for this resource in chronological order
        FOR v_waitlist_record IN 
            SELECT id, resource_id, club_id, requested_start, requested_end
            FROM public.resource_waitlists
            WHERE resource_id = COALESCE(OLD.resource_id, NEW.resource_id)
            ORDER BY created_at ASC
        LOOP
            -- Check if this waitlist time slot has any conflict with other CONFIRMED/APPROVED bookings
            SELECT EXISTS (
                SELECT 1 
                FROM public.resource_bookings b
                WHERE b.resource_id = v_waitlist_record.resource_id
                  AND (b.status = 'CONFIRMED' OR b.status = 'APPROVED')
                  -- Exclude the current updated booking row to avoid false conflicts
                  AND b.id IS DISTINCT FROM COALESCE(NEW.id, OLD.id)
                  AND tstzrange(b.start_time, b.end_time) && tstzrange(v_waitlist_record.requested_start, v_waitlist_record.requested_end)
            ) INTO v_conflict_exists;

            -- If no conflict, assign the resource to this club!
            IF NOT v_conflict_exists THEN
                -- Get club name
                SELECT name INTO v_club_name 
                FROM public.clubs 
                WHERE id = v_waitlist_record.club_id;

                -- Insert new booking
                INSERT INTO public.resource_bookings (
                    resource_id, 
                    club_id, 
                    organizer_club_name, 
                    start_time, 
                    end_time, 
                    status
                )
                VALUES (
                    v_waitlist_record.resource_id,
                    v_waitlist_record.club_id,
                    COALESCE(v_club_name, 'Unknown Club'),
                    v_waitlist_record.requested_start,
                    v_waitlist_record.requested_end,
                    OLD.status
                );

                -- Delete from waitlist
                DELETE FROM public.resource_waitlists 
                WHERE id = v_waitlist_record.id;

                -- Dispatch Push Notifications to club admins
                INSERT INTO public.notifications (user_id, type, title, message, link)
                SELECT 
                    cm.user_id,
                    'resource_booking',
                    'Resource Reservation Promoted',
                    'Your club has been automatically assigned the resource: ' || v_resource_name || ' for the period ' || 
                    to_char(v_waitlist_record.requested_start, 'YYYY-MM-DD HH24:MI') || ' to ' || 
                    to_char(v_waitlist_record.requested_end, 'YYYY-MM-DD HH24:MI') || '.',
                    '/club/' || v_waitlist_record.club_id || '/resources'
                FROM public.club_members cm
                WHERE cm.club_id = v_waitlist_record.club_id
                  AND cm.role = 'admin'::public.member_role
                  AND cm.status = 'approved'::public.join_status;

                -- Since the slot is filled, stop checking further waitlist entries
                EXIT;
            END IF;
        END LOOP;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Attach trigger
DROP TRIGGER IF EXISTS trg_process_resource_waitlist_on_change ON public.resource_bookings;
CREATE TRIGGER trg_process_resource_waitlist_on_change
AFTER UPDATE OR DELETE ON public.resource_bookings
FOR EACH ROW
EXECUTE FUNCTION public.process_resource_waitlist_on_booking_change();
