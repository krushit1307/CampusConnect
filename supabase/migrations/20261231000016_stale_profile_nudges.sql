-- Migration: 20261231000016_stale_profile_nudges.sql
-- Description: Automated "Stale Data" Profile Nudges (#3595)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_last_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS major TEXT;

-- RPC to confirm profile is up to date (resets profile_last_updated_at for another year)
CREATE OR REPLACE FUNCTION public.confirm_profile_freshness(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET profile_last_updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_profile_freshness TO authenticated, anon;
