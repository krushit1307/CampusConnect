export function nowIso() {
  return new Date().toISOString();
}

export function hoursSince(isoTime, now = new Date()) {
  if (!isoTime) return Number.POSITIVE_INFINITY;
  const then = new Date(isoTime);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60);
}
