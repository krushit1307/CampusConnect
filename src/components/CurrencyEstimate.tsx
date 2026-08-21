import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  convertUsdToCurrency,
  currencyForLocale,
  formatCurrencyAmount,
  normalizeCurrency,
  type CurrencyCode,
} from "@/lib/currency";

interface CurrencyRateResponse {
  rate?: number;
  rate_date?: string | null;
  stale?: boolean;
}

interface CurrencyEstimateProps {
  amountUsd: number;
  preferredCurrency?: string | null;
}

export function CurrencyEstimate({ amountUsd, preferredCurrency }: CurrencyEstimateProps) {
  const targetCurrency = useMemo(
    () =>
      normalizeCurrency(preferredCurrency) ||
      currencyForLocale(typeof navigator === "undefined" ? undefined : navigator.language),
    [preferredCurrency],
  );
  const [rate, setRate] = useState<number | null>(targetCurrency === "USD" ? 1 : null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRate(targetCurrency === "USD" ? 1 : null);
    setRateDate(null);
    setStale(false);

    if (targetCurrency === "USD") return () => undefined;

    const loadRate = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/currency-rate?currency=${targetCurrency}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!response.ok) return;
        const body = (await response.json()) as CurrencyRateResponse;
        if (!cancelled && typeof body.rate === "number" && body.rate > 0) {
          setRate(body.rate);
          setRateDate(body.rate_date ?? null);
          setStale(body.stale === true);
        }
      } catch {
        // Currency estimates are optional and must never block checkout.
      }
    };

    void loadRate();
    return () => {
      cancelled = true;
    };
  }, [targetCurrency]);

  if (amountUsd <= 0 || targetCurrency === "USD") return null;

  if (rate === null) {
    return (
      <span
        className="mt-1 flex items-center gap-1 text-xs font-mono text-black/50"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Loading {targetCurrency} estimate…
      </span>
    );
  }

  const convertedAmount = convertUsdToCurrency(amountUsd, rate);
  const formatted = formatCurrencyAmount(convertedAmount, targetCurrency as CurrencyCode);
  const dateLabel = rateDate ? ` · rate date ${rateDate}` : "";

  return (
    <span
      className="mt-1 flex flex-wrap items-center gap-1 text-xs font-mono text-black/70"
      aria-live="polite"
    >
      <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
      <span>
        Est. {formatted} {targetCurrency}
      </span>
      <span className="text-black/45">
        ({stale ? "latest cached rate" : "informational estimate"}
        {dateLabel})
      </span>
    </span>
  );
}
