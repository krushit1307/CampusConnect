import { useMemo } from "react";
import { CloudOff } from "lucide-react";
import { WEATHER_ICON_COMPONENT } from "@/components/weather/icons";
import { useWeather } from "@/components/weather/useWeather";
import type { WeatherSnapshot } from "@/components/weather/types";
import { WidgetShell } from "./WidgetShell";

export interface WeatherWidgetProps {
  params: Record<string, unknown>;
}

function strParam(params: Record<string, unknown>, key: string): string {
  return typeof params[key] === "string" ? (params[key] as string) : "";
}

/**
 * Builds a fetcher that calls the weather Supabase Edge Function proxy
 * (/api/weather) with the configured location. The OpenWeather API key
 * stays server-side inside the Edge Function — it never reaches the
 * client (issue #2737 edge case).
 */
function createWeatherFetcher(location: string): () => Promise<WeatherSnapshot> {
  const base = (import.meta.env.VITE_WEATHER_URL as string | undefined) ?? "/api/weather";
  const url = location ? `${base}?q=${encodeURIComponent(location)}` : base;

  return () =>
    fetch(url, { credentials: "include" }).then(async (res) => {
      if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
      const data = (await res.json()) as WeatherSnapshot;
      if (!data || typeof data.tempC !== "number" || !data.condition) {
        throw new Error("Malformed weather payload");
      }
      return data;
    });
}

/**
 * Location-aware weather widget. Follows the #1915 fail-open contract:
 * loading shows a placeholder, any fetch failure shows an inline
 * "unavailable" message instead of throwing.
 */
export function WeatherWidget({ params }: WeatherWidgetProps) {
  const location = strParam(params, "location");
  const fetcher = useMemo(() => createWeatherFetcher(location), [location]);
  const state = useWeather({ fetcher });

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <WidgetShell title="Weather" className="min-h-[104px]">
        <p className="font-mono text-xs text-gray-400">Loading weather...</p>
      </WidgetShell>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <WidgetShell title="Weather" className="min-h-[104px]">
        <div className="flex items-center gap-2 font-mono text-xs text-gray-500" aria-live="polite">
          <CloudOff size={16} aria-hidden="true" />
          <span>Weather unavailable</span>
        </div>
      </WidgetShell>
    );
  }

  const { snapshot } = state;
  const Icon = WEATHER_ICON_COMPONENT[snapshot.condition] ?? CloudOff;

  return (
    <WidgetShell title="Weather">
      <div className="flex items-center gap-3">
        <Icon className="h-10 w-10 shrink-0 text-[var(--theme-primary)]" aria-hidden="true" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-display text-3xl font-bold">{Math.round(snapshot.tempC)}°C</span>
          <span className="truncate font-mono text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
            {snapshot.locationName} · {snapshot.description}
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

export default WeatherWidget;
