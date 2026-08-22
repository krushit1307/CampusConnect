export const WEATHER_ALERT_PRECIPITATION_THRESHOLD = 0.6;
export const WEATHER_ALERT_HEAT_CELSIUS = 35;
export const WEATHER_MONITOR_WINDOW_HOURS = 72;

export type SevereWeatherKind = "heavy_rain" | "snow" | "extreme_heat";

export interface WeatherForecastPoint {
  forecastTime: string;
  condition: string;
  precipitationProbability: number;
  temperatureC: number | null;
}

export interface SevereWeatherAlert {
  kind: SevereWeatherKind;
  label: string;
  forecast: WeatherForecastPoint;
}

function normalizeProbability(value: number) {
  const probability = Number(value);
  if (!Number.isFinite(probability)) return 0;
  return Math.min(1, Math.max(0, probability > 1 ? probability / 100 : probability));
}

export function findClosestForecast<T extends { forecastTime: string }>(
  forecasts: T[],
  eventTime: string,
) {
  const target = Date.parse(eventTime);
  if (!Number.isFinite(target) || forecasts.length === 0) return null;

  return (
    forecasts
      .filter((forecast) => Number.isFinite(Date.parse(forecast.forecastTime)))
      .sort(
        (left, right) =>
          Math.abs(Date.parse(left.forecastTime) - target) -
          Math.abs(Date.parse(right.forecastTime) - target),
      )[0] ?? null
  );
}

export function getSevereWeatherAlert(forecast: WeatherForecastPoint): SevereWeatherAlert | null {
  const condition = forecast.condition.toLowerCase();
  const probability = normalizeProbability(forecast.precipitationProbability);
  const temperatureC = Number(forecast.temperatureC);

  if (
    (condition.includes("rain") || condition.includes("thunderstorm")) &&
    probability >= WEATHER_ALERT_PRECIPITATION_THRESHOLD
  ) {
    return { kind: "heavy_rain", label: "heavy rain or thunderstorms", forecast };
  }
  if (condition.includes("snow") && probability >= WEATHER_ALERT_PRECIPITATION_THRESHOLD) {
    return { kind: "snow", label: "snow", forecast };
  }
  if (temperatureC >= WEATHER_ALERT_HEAT_CELSIUS) {
    return { kind: "extreme_heat", label: "extreme heat", forecast };
  }
  return null;
}

export function getIndoorBackupVenueUrl(
  eventId: string,
  eventTime: string,
  eventEndTime?: string | null,
) {
  const params = new URLSearchParams({
    action: "find-indoor-backup",
    outdoor: "false",
    starts_at: eventTime,
  });
  if (eventEndTime) params.set("ends_at", eventEndTime);
  return `/events/${eventId}?${params.toString()}`;
}

export function isWithinMonitorWindow(eventTime: string, now = new Date()) {
  const timestamp = Date.parse(eventTime);
  if (!Number.isFinite(timestamp)) return false;
  const delta = timestamp - now.getTime();
  return delta >= 0 && delta <= WEATHER_MONITOR_WINDOW_HOURS * 60 * 60 * 1000;
}

export function formatWeatherAlertMessage(
  eventTitle: string,
  alert: SevereWeatherAlert,
  backupUrl: string,
) {
  const probability = Math.round(
    normalizeProbability(alert.forecast.precipitationProbability) * 100,
  );
  return `The forecast for "${eventTitle}" shows ${alert.label} near the event time (${probability}% precipitation probability). Secure an indoor venue now: ${backupUrl}`;
}
