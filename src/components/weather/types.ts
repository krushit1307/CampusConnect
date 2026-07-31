/**
 * Weather widget data contracts (issue #1915).
 *
 * The widget consumes normalized weather data regardless of the
 * upstream provider — today OpenWeather, tomorrow maybe another.
 * The Edge Function at /api/weather is responsible for translating
 * the upstream response into this shape so the React layer can
 * stay decoupled.
 */

/** OpenWeather main condition codes we render icons for. */
export type WeatherConditionCode =
  "clear" | "clouds" | "rain" | "drizzle" | "thunderstorm" | "snow" | "mist" | "unknown";

/** Normalized current-conditions payload from /api/weather. */
export interface WeatherSnapshot {
  /** Temperature in Celsius. */
  tempC: number;
  /** Short human label, e.g. "Partly cloudy". */
  description: string;
  /** Condition bucket used to pick the icon. */
  condition: WeatherConditionCode;
  /** City / campus label the API resolved to. */
  locationName: string;
  /** ISO timestamp the snapshot was generated at. */
  observedAt: string;
}

/** Possible widget states surfaced to the UI. */
export type WeatherState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; snapshot: WeatherSnapshot }
  | { kind: "unavailable"; reason: string };

/** Public hook options. */
export interface UseWeatherOptions {
  /**
   * Caller-supplied fetcher. Lets the Edge Function URL stay out of
   * the bundle and lets tests inject a stub. Default uses fetch() to
   * call /api/weather.
   */
  fetcher?: () => Promise<WeatherSnapshot>;
  /** Polling interval in ms. Defaults to 30 minutes per the spec. */
  refreshIntervalMs?: number;
  /** Disable the network call entirely (e.g. in Storybook). */
  enabled?: boolean;
}
