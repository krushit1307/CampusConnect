-- 1. Ensure the strike_count column exists on profiles
-- (Adding this safely just in case it hasn't been created yet)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS strike_count INTEGER DEFAULT 0;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.check_strike_count_and_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user hits 3 (or more) strikes, automatically set is_banned to true
  -- Using >= 3 is safer than = 3 in case a user is given multiple strikes at once
  IF NEW.strike_count >= 3 THEN
    NEW.is_banned := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to the profiles table
-- We use a WHEN clause as a performance optimization so the trigger 
-- only executes when the strike_count is actually being modified.
DROP TRIGGER IF EXISTS trigger_auto_ban_on_strikes ON public.profiles;

CREATE TRIGGER trigger_auto_ban_on_strikes
BEFORE UPDATE OF strike_count ON public.profiles
FOR EACH ROW
WHEN (OLD.strike_count IS DISTINCT FROM NEW.strike_count)
EXECUTE FUNCTION public.check_strike_count_and_ban();
