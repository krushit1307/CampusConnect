-- Issue #3886: Dynamic Multi-Currency Display
-- Rates are informational estimates only; checkout remains settled in USD.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_currency_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_currency_check
      CHECK (preferred_currency IN (
        'USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY',
        'CHF', 'SGD', 'AED', 'NZD', 'HKD', 'KRW', 'BRL', 'ZAR'
      ));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.currency_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  quote_currency TEXT NOT NULL,
  rate NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
  rate_date DATE NOT NULL,
  cache_date DATE NOT NULL DEFAULT CURRENT_DATE,
  provider TEXT NOT NULL DEFAULT 'frankfurter',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT currency_exchange_rates_base_check CHECK (base_currency = 'USD'),
  CONSTRAINT currency_exchange_rates_quote_check CHECK (quote_currency <> 'USD'),
  UNIQUE (base_currency, quote_currency, cache_date)
);

CREATE INDEX IF NOT EXISTS idx_currency_exchange_rates_lookup
  ON public.currency_exchange_rates (base_currency, quote_currency, cache_date DESC);

ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read currency rates"
  ON public.currency_exchange_rates;
CREATE POLICY "Authenticated users can read currency rates"
  ON public.currency_exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.currency_exchange_rates IS
  'Daily cached informational exchange rates used for non-binding USD price estimates.';
COMMENT ON COLUMN public.currency_exchange_rates.rate IS
  'Number of quote-currency units per one USD.';
COMMENT ON COLUMN public.currency_exchange_rates.cache_date IS
  'UTC application date on which this provider response was fetched.';
