-- Follow-up to #5258: correct the claim-window boundary
--
-- gift_aid_claimable_until named itself the last date a claim may include a
-- donation and returned the exclusive 6 April boundary — the first day it can
-- no longer be claimed. Anything putting that value on a screen or into a
-- reminder is a day late, and the window is one nobody gets a second attempt at.
--
-- The behaviour of the boundary is unchanged; what changes is that the function
-- now returns the day it says it returns.

CREATE OR REPLACE FUNCTION public.gift_aid_claimable_until(p_date DATE)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT (public.gift_aid_tax_year_start(p_date) + INTERVAL '5 years' - INTERVAL '1 day')::DATE;
$$;

COMMENT ON FUNCTION public.gift_aid_claimable_until(DATE) IS
  'The last day a claim may include a donation received on p_date, inclusive.';
