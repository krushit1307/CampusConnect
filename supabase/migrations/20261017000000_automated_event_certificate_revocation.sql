-- Migration: 20261017000000_automated_event_certificate_revocation.sql
-- Description: Create certificate_revocations table and trigger on event_rsvps check-out to flag certificates as revoked.

-- 1. Create certificate_revocations table
CREATE TABLE IF NOT EXISTS public.certificate_revocations (
    hash TEXT PRIMARY KEY,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.certificate_revocations ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policies
CREATE POLICY "Anyone can view certificate revocations" 
ON public.certificate_revocations FOR SELECT USING (true);

CREATE POLICY "Organizers can insert certificate revocations" 
ON public.certificate_revocations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Organizers can delete certificate revocations" 
ON public.certificate_revocations FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Create Trigger Function to automatically handle certificate revocation on check-in state change
CREATE OR REPLACE FUNCTION public.handle_certificate_revocation_on_rsvp_change()
RETURNS TRIGGER AS $$
DECLARE
    v_hash TEXT;
BEGIN
    -- A. Handle check-out / revocation: checked_in flips from true to false
    IF OLD.checked_in = TRUE AND NEW.checked_in = FALSE THEN
        -- Find verification hash of the certificate
        SELECT verification_hash INTO v_hash
        FROM public.certificates
        WHERE event_id = OLD.event_id AND user_id = OLD.user_id;

        IF v_hash IS NOT NULL AND v_hash <> '' THEN
            INSERT INTO public.certificate_revocations (hash, reason, revoked_by)
            VALUES (v_hash, 'Manual check-in revocation by organizer', auth.uid())
            ON CONFLICT (hash) DO UPDATE 
            SET revoked_at = NOW(), reason = EXCLUDED.reason, revoked_by = EXCLUDED.revoked_by;
            
            -- Clear/update certificate_url to reflect revoked state
            UPDATE public.certificates
            SET certificate_url = 'revoked'
            WHERE event_id = OLD.event_id AND user_id = OLD.user_id;
        END IF;
    END IF;

    -- B. Handle Undo check-in: checked_in flips from false to true
    IF OLD.checked_in = FALSE AND NEW.checked_in = TRUE THEN
        -- Find verification hash of the certificate
        SELECT verification_hash INTO v_hash
        FROM public.certificates
        WHERE event_id = NEW.event_id AND user_id = NEW.user_id;

        IF v_hash IS NOT NULL AND v_hash <> '' THEN
            -- Delete the revocation record to restore validity
            DELETE FROM public.certificate_revocations WHERE hash = v_hash;
            
            -- Reset certificate_url to pending so it gets regenerated
            UPDATE public.certificates
            SET certificate_url = 'pending'
            WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Register the trigger
DROP TRIGGER IF EXISTS trg_handle_certificate_revocation_on_rsvp_change ON public.event_rsvps;

CREATE TRIGGER trg_handle_certificate_revocation_on_rsvp_change
AFTER UPDATE OF checked_in ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.handle_certificate_revocation_on_rsvp_change();
