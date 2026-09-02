-- =============================================================================
-- Migration: 20270916000000_automated_poap_minting.sql
-- Description: Issue #5057 - Automated Proof-of-Attendance Protocol (POAP) Minting Engine
-- =============================================================================

BEGIN;

-- 1. Extend profiles to support Web3 wallets
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$');

-- 2. Create poap_events configuration table
CREATE TABLE IF NOT EXISTS public.poap_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    poap_id INTEGER NOT NULL, -- The official POAP Event ID
    badge_title TEXT NOT NULL,
    badge_image_url TEXT NOT NULL,
    secret_code TEXT, -- Organizer credential
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id)
);

-- 3. Create poap_claims log table
CREATE TABLE IF NOT EXISTS public.poap_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poap_event_id UUID NOT NULL REFERENCES public.poap_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    token_id TEXT, -- NFT token identifier
    transaction_hash TEXT, -- Blockchain txn link
    minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(poap_event_id, user_id)
);

-- 4. Create poap_mint_jobs database-backed SQS queue table
CREATE TABLE IF NOT EXISTS public.poap_mint_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    poap_event_id UUID NOT NULL REFERENCES public.poap_events(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.poap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poap_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poap_mint_jobs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Allow public select of poap events"
ON public.poap_events FOR SELECT USING (true);

CREATE POLICY "Allow public select of poap claims"
ON public.poap_claims FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage poap events"
ON public.poap_events FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

CREATE POLICY "Allow admins to manage poap claims"
ON public.poap_claims FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

CREATE POLICY "Allow users to read their own poap jobs"
ON public.poap_mint_jobs FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE id = rsvp_id AND user_id = auth.uid()
    )
);

-- 7. Trigger on event_rsvps check-in status update
CREATE OR REPLACE FUNCTION public.fn_trigger_poap_on_rsvp_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_poap RECORD;
    v_wallet TEXT;
    v_active_job_id UUID;
    v_event_title TEXT;
BEGIN
    -- Only act if student checked_in transitions from FALSE to TRUE
    IF NEW.checked_in = TRUE AND (OLD.checked_in = FALSE OR OLD.checked_in IS NULL) THEN
        -- 1. Check if a POAP Event is registered for this event
        SELECT * INTO v_poap FROM public.poap_events WHERE event_id = NEW.event_id;
        IF NOT FOUND THEN
            RETURN NEW;
        END IF;

        -- 2. Fetch student's Web3 wallet address
        SELECT wallet_address INTO v_wallet FROM public.profiles WHERE id = NEW.user_id;

        IF v_wallet IS NOT NULL THEN
            -- Verify if job is already queued/created to prevent duplicates
            SELECT id INTO v_active_job_id FROM public.poap_mint_jobs 
            WHERE rsvp_id = NEW.id AND poap_event_id = v_poap.id;

            IF v_active_job_id IS NULL THEN
                INSERT INTO public.poap_mint_jobs (rsvp_id, poap_event_id, wallet_address, status)
                VALUES (NEW.id, v_poap.id, v_wallet, 'PENDING');
            END IF;
        ELSE
            -- Wallet is missing: Dispatch warning notification to user
            SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;

            INSERT INTO public.notifications (user_id, type, title, message, link)
            VALUES (
                NEW.user_id,
                'poap_pending_wallet',
                '🎓 NFT Badge Waiting for Web3 Wallet',
                'Your attendance for "' || COALESCE(v_event_title, 'Prestige Lecture') || '" has been verified! Save your Web3 wallet address to your profile to claim your Proof of Attendance (PoAP) NFT.',
                '/profile/' || (SELECT handle FROM public.profiles WHERE id = NEW.user_id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_poap_on_rsvp_checkin
AFTER UPDATE OF checked_in ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_poap_on_rsvp_checkin();

COMMIT;
