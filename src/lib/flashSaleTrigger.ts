export const FLASH_SALE_TRIGGER_DISCOUNT_PERCENT = 20;
export const FLASH_SALE_TRIGGER_DURATION_HOURS = 24;
export const FLASH_SALE_BOOKMARK_EMAIL =
  "FLASH SALE: Tickets are 20% off for the next 24 hours!";

export type FlashSaleTriggerType = "hours_before_event" | "weather_rain";

export function isHoursBeforeEventTriggerMet(
  eventStartIso: string | null | undefined,
  hoursBefore: number,
  now = new Date(),
): boolean {
  if (!eventStartIso || !Number.isFinite(hoursBefore) || hoursBefore <= 0) return false;
  const startMs = new Date(eventStartIso).getTime();
  if (!Number.isFinite(startMs)) return false;
  const remainingMs = startMs - now.getTime();
  return remainingMs > 0 && remainingMs <= hoursBefore * 60 * 60 * 1000;
}

export function forecastPredictsRain(condition: string | null | undefined): boolean {
  const value = (condition || "").toLowerCase();
  return value.includes("rain") || value.includes("drizzle") || value.includes("thunderstorm");
}
