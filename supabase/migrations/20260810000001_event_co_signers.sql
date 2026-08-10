-- Add high-risk event fields
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_high_risk BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alcohol_present BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS off_campus_speaker BOOLEAN DEFAULT FALSE;

-- Update club_analytics_view to include the new columns
CREATE OR REPLACE VIEW public.club_analytics_view AS
SELECT 
    e.id,
    e.club_id,
    e.title,
    e.description,
    e.banner_url,
    e.event_date,
    e.start_date,
    e.end_date,
    e.location,
    e.created_by,
    e.created_at,
    e.updated_at,
    e.is_high_risk,
    e.alcohol_present,
    e.off_campus_speaker,
    e.status,
    COALESCE(COUNT(r.id), 0)::integer AS attendee_count
FROM events e
LEFT JOIN event_rsvps r ON e.id = r.event_id
GROUP BY e.id;

-- Grant select access to authenticated and anonymous roles
GRANT SELECT ON public.club_analytics_view TO authenticated, anon;

-- Create event_signatures audit table
CREATE TABLE IF NOT EXISTS public.event_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    signer_role TEXT NOT NULL,
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signature_token UUID NOT NULL DEFAULT gen_random_uuid(),
    signed_at TIMESTAMPTZ,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, signer_role)
);

-- Enable RLS on event_signatures
ALTER TABLE public.event_signatures ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone can select signatures
DROP POLICY IF EXISTS "Signatures are viewable by everyone." ON public.event_signatures;
CREATE POLICY "Signatures are viewable by everyone."
ON public.event_signatures FOR SELECT
USING (true);

-- Insert/update policy: Admins or service role
DROP POLICY IF EXISTS "System admins can modify signatures." ON public.event_signatures;
CREATE POLICY "System admins can modify signatures."
ON public.event_signatures FOR ALL
USING (public.is_system_admin());

-- Trigger to calculate high-risk status and force status constraints
CREATE OR REPLACE FUNCTION public.calculate_event_high_risk()
RETURNS TRIGGER AS $$
DECLARE
    unsigned_count INTEGER;
BEGIN
    -- Check if high risk criteria are met
    IF NEW.alcohol_present = TRUE OR (NEW.max_attendees IS NOT NULL AND NEW.max_attendees > 200) OR NEW.off_campus_speaker = TRUE THEN
        NEW.is_high_risk := TRUE;
    ELSE
        NEW.is_high_risk := FALSE;
    END IF;
    
    -- Status constraints for high risk events
    IF NEW.is_high_risk = TRUE THEN
        -- Count unsigned signatures (if the event already exists)
        IF NEW.id IS NOT NULL THEN
            SELECT COUNT(*) INTO unsigned_count
            FROM public.event_signatures
            WHERE event_id = NEW.id AND signed_at IS NULL;
        ELSE
            unsigned_count := 3; -- Assume all 3 need signatures initially
        END IF;

        -- If not fully signed, block publication status
        IF unsigned_count > 0 AND NEW.status = 'published' THEN
            NEW.status := 'pending_signatures';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind calculate trigger BEFORE insert/update
DROP TRIGGER IF EXISTS trg_calculate_event_high_risk ON public.events;
CREATE TRIGGER trg_calculate_event_high_risk
BEFORE INSERT OR UPDATE OF alcohol_present, max_attendees, off_campus_speaker, status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.calculate_event_high_risk();


-- Trigger to populate co-signers
CREATE OR REPLACE FUNCTION public.populate_required_event_signatures()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_high_risk = TRUE THEN
        -- Insert Faculty Advisor requirement
        INSERT INTO public.event_signatures (event_id, signer_role, signer_name, signer_email)
        VALUES (NEW.id, 'Advisor', 'Faculty Advisor', 'advisor@campusconnect.test')
        ON CONFLICT (event_id, signer_role) DO NOTHING;
        
        -- Insert Dean of Students requirement
        INSERT INTO public.event_signatures (event_id, signer_role, signer_name, signer_email)
        VALUES (NEW.id, 'Dean of Students', 'Dean Miller', 'dean@campusconnect.test')
        ON CONFLICT (event_id, signer_role) DO NOTHING;
        
        -- Insert Campus Security requirement
        INSERT INTO public.event_signatures (event_id, signer_role, signer_name, signer_email)
        VALUES (NEW.id, 'Campus Security', 'Chief Officer', 'security@campusconnect.test')
        ON CONFLICT (event_id, signer_role) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind populate trigger AFTER insert/update
DROP TRIGGER IF EXISTS trg_populate_required_event_signatures ON public.events;
CREATE TRIGGER trg_populate_required_event_signatures
AFTER INSERT OR UPDATE OF is_high_risk ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.populate_required_event_signatures();


-- Trigger to invalidate signatures on event edits
CREATE OR REPLACE FUNCTION public.check_event_modification_signatures()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_high_risk = TRUE OR NEW.is_high_risk = TRUE THEN
        -- If any key fields are updated, reset existing signatures
        IF OLD.title IS DISTINCT FROM NEW.title OR
           OLD.description IS DISTINCT FROM NEW.description OR
           OLD.start_date IS DISTINCT FROM NEW.start_date OR
           OLD.end_date IS DISTINCT FROM NEW.end_date OR
           OLD.location IS DISTINCT FROM NEW.location OR
           OLD.max_attendees IS DISTINCT FROM NEW.max_attendees OR
           OLD.alcohol_present IS DISTINCT FROM NEW.alcohol_present OR
           OLD.off_campus_speaker IS DISTINCT FROM NEW.off_campus_speaker THEN
           
           -- Invalidate all signs
           UPDATE public.event_signatures
           SET signed_at = NULL,
               ip_address = NULL,
               signature_token = gen_random_uuid(),
               created_at = NOW()
           WHERE event_id = NEW.id;
           
           -- Reset status
           NEW.status := 'pending_signatures';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind invalidate trigger BEFORE update
DROP TRIGGER IF EXISTS trg_check_event_modification_signatures ON public.events;
CREATE TRIGGER trg_check_event_modification_signatures
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.check_event_modification_signatures();


-- pg_cron Nudge function
CREATE OR REPLACE FUNCTION public.nudge_pending_co_signers()
RETURNS void AS $$
DECLARE
    sig_row RECORD;
BEGIN
    FOR sig_row IN 
        SELECT es.id, es.event_id, es.signer_email, es.signer_name, es.signer_role, e.title
        FROM public.event_signatures es
        JOIN public.events e ON e.id = es.event_id
        WHERE es.signed_at IS NULL
          AND e.status = 'pending_signatures'
          AND es.created_at < NOW() - INTERVAL '48 hours'
    LOOP
        -- Nudge logs indicating automated nudge sent
        RAISE WARNING 'AUTOMATED NUDGE: Co-signer approval required for % (%) on high-risk event "%"', 
            sig_row.signer_name, sig_row.signer_email, sig_row.title;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule pg_cron hourly nudge check
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
    'nudge-pending-co-signers',
    '0 * * * *',
    $$SELECT public.nudge_pending_co_signers();$$
);
