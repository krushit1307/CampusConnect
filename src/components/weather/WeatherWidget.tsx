import CloudOff from "lucide-react/dist/esm/icons/cloud-off";
import { WEATHER_ICON_COMPONENT } from "./icons";
import { type WeatherState } from "./types";
import { useWeather } from "./useWeather";

interface WeatherWidgetProps {
  /** Pass `false` to short-circuit the fetch (e.g. on a Storybook canvas). */
  enabled?: boolean;
}

/**
 * WeatherWidget — campus dashboard surface for the OpenWeather-backed
 * snapshot. Renders nothing while idle/loading/unavailable so it doesn't
 * break the surrounding layout (issue #1915 fail-open contract).
 */
export function WeatherWidget({ enabled = true }: WeatherWidgetProps = {}) {
  const state = useWeather({ enabled });

  if (state.kind === "idle" || state.kind === "loading") {
    return null;
  }

  if (state.kind === "unavailable") {
    return (
      <div
        data-testid="weather-widget"
        data-state="unavailable"
        className="neu-border flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs text-gray-500 dark:bg-black dark:text-gray-400"
        aria-live="polite"
      >
        <CloudOff size={16} aria-hidden="true" />
        <span>Weather unavailable</span>
      </div>
    );
  }

  const { snapshot } = state;
  const Icon = WEATHER_ICON_COMPONENT[snapshot.condition] ?? CloudOff;

  return (
    <div
      data-testid="weather-widget"
      data-state="ready"
      className="neu-border flex items-center gap-3 bg-white px-3 py-2 font-mono text-xs dark:bg-black"
      aria-label={`Current weather at ${snapshot.locationName}: ${snapshot.description}, ${snapshot.tempC} degrees Celsius`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <div className="flex flex-col leading-tight">
        <span className="text-base font-bold">{Math.round(snapshot.tempC)}°C</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
          {snapshot.locationName} · {snapshot.description}
        </span>
      </div>
    </div>
  );
}

export default WeatherWidget;
