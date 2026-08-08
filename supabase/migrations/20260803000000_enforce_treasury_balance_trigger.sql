CREATE OR REPLACE FUNCTION public.enforce_treasury_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(12,2);
BEGIN
  IF NEW.type = 'expense' AND NEW.status = 'approved' THEN
    -- Serialize concurrent expense inserts for the same club.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.club_id::text, 0));

    SELECT
      COALESCE((SELECT SUM(total_allocated) FROM public.budgets WHERE club_id = NEW.club_id), 0)
      + COALESCE((SELECT SUM(amount) FROM public.transactions WHERE club_id = NEW.club_id AND type = 'income' AND status = 'approved'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.transactions WHERE club_id = NEW.club_id AND type = 'expense' AND status = 'approved'), 0)
    INTO current_balance;

    IF (current_balance - NEW.amount) < 0 THEN
      RAISE EXCEPTION 'Insufficient Funds';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_treasury_balance ON public.transactions;

CREATE TRIGGER trg_enforce_treasury_balance
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_treasury_balance();