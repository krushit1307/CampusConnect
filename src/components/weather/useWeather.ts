import { useEffect, useState } from "react";
import { type UseWeatherOptions, type WeatherSnapshot, type WeatherState } from "./types";

const DEFAULT_REFRESH_MS = 30 * 60 * 1000;

function defaultFetcher(url: string): Promise<WeatherSnapshot> {
  return fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Weather fetch failed (${res.status})`);
    }
    const data = (await res.json()) as WeatherSnapshot;
    if (!data || typeof data.tempC !== "number" || !data.condition) {
      throw new Error("Malformed weather payload");
    }
    return data;
  });
}

/**
 * useWeather — fetches /api/weather (or the caller-supplied fetcher) and
 * surfaces the result as a discriminated union. Implements the issue #1915
 * fail-open UI contract: any fetch error transitions to "unavailable"
 * rather than throwing.
 */
export function useWeather(opts: UseWeatherOptions = {}): WeatherState {
  const { fetcher, refreshIntervalMs = DEFAULT_REFRESH_MS, enabled = true } = opts;
  const [state, setState] = useState<WeatherState>({ kind: "idle" });

  useEffect(() => {
    if (!enabled) {
      setState({ kind: "idle" });
      return;
    }

    let cancelled = false;
    const url = (import.meta.env.VITE_WEATHER_URL as string | undefined) ?? "/api/weather";

    async function run() {
      if (!cancelled) setState({ kind: "loading" });
      try {
        const snapshot = fetcher ? await fetcher() : await defaultFetcher(url);
        if (!cancelled) setState({ kind: "ready", snapshot });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "unavailable",
            reason: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    void run();
    const interval = window.setInterval(run, refreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetcher, refreshIntervalMs, enabled]);

  return state;
}
