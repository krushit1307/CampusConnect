-- Migration: 20261025000000_automated_member_birthday_shoutout.sql
-- Description: Create user_private_details table for strict birth_date privacy, club shoutout toggle, and upcoming birthdays RPC (#3276).

-- 1. Create user_private_details table
CREATE TABLE IF NOT EXISTS public.user_private_details (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    birth_date DATE,
    share_birthday BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on user_private_details
ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own private details" ON public.user_private_details
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create updated_at timestamps
CREATE TRIGGER set_updated_at_user_private_details
    BEFORE UPDATE ON public.user_private_details
    FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 2. Add auto_post_birthdays setting column to clubs table
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS auto_post_birthdays BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create RPC to search for active club members whose birthday is in 3 days
CREATE OR REPLACE FUNCTION public.get_upcoming_member_birthdays()
RETURNS TABLE (
    user_id UUID,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    club_id UUID,
    club_name TEXT,
    auto_post_birthdays BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS user_id,
        p.first_name AS first_name,
        p.last_name AS last_name,
        upd.birth_date AS birth_date,
        cm.club_id AS club_id,
        c.name AS club_name,
        c.auto_post_birthdays AS auto_post_birthdays
    FROM public.user_private_details upd
    JOIN public.profiles p ON upd.user_id = p.id
    JOIN public.club_members cm ON cm.user_id = p.id
    JOIN public.clubs c ON cm.club_id = c.id
    WHERE upd.share_birthday = TRUE
      AND cm.status = 'approved'
      AND EXTRACT(MONTH FROM upd.birth_date) = EXTRACT(MONTH FROM (now() + INTERVAL '3 days'))
      AND EXTRACT(DAY FROM upd.birth_date) = EXTRACT(DAY FROM (now() + INTERVAL '3 days'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_member_birthdays() TO authenticated, service_role;

-- 4. Set up pg_cron job calling the Deno Edge Function daily at midnight
SELECT cron.schedule(
  'member-birthday-shoutout-cron',
  '0 0 * * *', -- Midnight every day
  $$
  SELECT net.http_post(
    url := 'http://localhost:54321/functions/v1/member-birthday-cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
