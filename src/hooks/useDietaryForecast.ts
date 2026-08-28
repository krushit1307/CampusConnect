// src/hooks/useDietaryForecast.ts
// -----------------------------------------------------------------------------
// Issue: #3931 — Implement 'Dynamic Dietary Restriction Forecasting'
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DietaryForecast } from "@/lib/dietaryForecast";

export interface UseDietaryForecastResult {
  forecast: DietaryForecast | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDietaryForecast(
  eventId: string | null | undefined,
): UseDietaryForecastResult {
  const supabase = createClient();
  const [forecast, setForecast] = useState<DietaryForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "forecast_dietary_needs",
        { p_event_id: eventId },
      );
      if (rpcError) throw rpcError;
      setForecast(data as DietaryForecast);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load dietary forecast";
      setError(msg);
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, supabase]);

  useEffect(() => {
    void fetchForecast();
  }, [fetchForecast]);

  return { forecast, isLoading, error, refresh: fetchForecast };
}
