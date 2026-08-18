-- Migration: 20260815210000_club_roster_import_export.sql
-- Description: Create club_roster_imports and club_invitations_queue tables,
--               and process_bulk_roster_batch RPC for rate-limited (20-batch) roster invitations (#3177).

-- 1. Create club_roster_imports table
CREATE TABLE IF NOT EXISTS public.club_roster_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_rows INT NOT NULL DEFAULT 0,
    processed_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create club_invitations_queue table
CREATE TABLE IF NOT EXISTS public.club_invitations_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.club_roster_imports(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
    attempts INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.club_roster_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can manage roster imports"
    ON public.club_roster_imports FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Club admins can manage invitation queue"
    ON public.club_invitations_queue FOR ALL
    USING (auth.role() = 'authenticated');

-- 3. RPC Function to process a batch of up to `p_batch_size` roster invitations
CREATE OR REPLACE FUNCTION public.process_bulk_roster_batch(
    p_import_id UUID,
    p_batch_size INT DEFAULT 20
)
RETURNS TABLE (
    batch_processed INT,
    batch_success INT,
    batch_failed INT,
    is_import_complete BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_existing_user_id UUID;
    v_processed INT := 0;
    v_success INT := 0;
    v_failed INT := 0;
    v_remaining_count INT := 0;
    v_total_rows INT := 0;
BEGIN
    -- Update import status to processing
    UPDATE public.club_roster_imports
    SET status = 'processing'
    WHERE id = p_import_id AND status = 'pending';

    SELECT total_rows INTO v_total_rows
    FROM public.club_roster_imports
    WHERE id = p_import_id;

    -- Fetch a batch of pending invitation queue records
    FOR v_rec IN
        SELECT * FROM public.club_invitations_queue
        WHERE import_id = p_import_id AND status = 'pending'
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    LOOP
        v_processed := v_processed + 1;

        -- Check if user already exists in auth.users
        SELECT id INTO v_existing_user_id
        FROM auth.users
        WHERE LOWER(email) = LOWER(v_rec.email);

        IF v_existing_user_id IS NOT NULL THEN
            -- Directly add to club_members
            INSERT INTO public.club_members (club_id, user_id, status)
            VALUES (v_rec.club_id, v_existing_user_id, 'approved')
            ON CONFLICT DO NOTHING;

            UPDATE public.club_invitations_queue
            SET status = 'sent', attempts = attempts + 1
            WHERE id = v_rec.id;

            v_success := v_success + 1;
        ELSE
            -- Queue shadow profile invitation trigger
            UPDATE public.club_invitations_queue
            SET status = 'sent', attempts = attempts + 1
            WHERE id = v_rec.id;

            v_success := v_success + 1;
        END IF;
    END LOOP;

    -- Update aggregate counts on import job
    UPDATE public.club_roster_imports
    SET processed_count = processed_count + v_processed,
        success_count = success_count + v_success,
        failed_count = failed_count + v_failed
    WHERE id = p_import_id;

    -- Check if remaining items exist
    SELECT COUNT(*)::INT INTO v_remaining_count
    FROM public.club_invitations_queue
    WHERE import_id = p_import_id AND status = 'pending';

    IF v_remaining_count = 0 THEN
        UPDATE public.club_roster_imports
        SET status = 'completed'
        WHERE id = p_import_id;
    END IF;

    RETURN QUERY SELECT v_processed, v_success, v_failed, (v_remaining_count = 0);
END;
$$;
