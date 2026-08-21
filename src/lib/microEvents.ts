export const MAX_MICRO_EVENT_CAPACITY = 6;
export const MICRO_EVENT_MIN_CAPACITY = 2;

export function normalizeCourseCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function isValidMicroEventCourseCode(value: string) {
  const normalized = normalizeCourseCode(value);
  return normalized.length >= 2 && normalized.length <= 32;
}

export function isValidMicroEventLocation(value: string) {
  const normalized = value.trim();
  return normalized.length >= 2 && normalized.length <= 160;
}

export function isValidMicroEventCapacity(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MICRO_EVENT_MIN_CAPACITY &&
    value <= MAX_MICRO_EVENT_CAPACITY
  );
}

export function formatMicroEventTimeRemaining(expiresAt: string, now = Date.now()) {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return "Expired";
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(minutes, 1)}m left`;
}
