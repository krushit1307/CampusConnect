export const EVENT_TLDR_MAX_LENGTH = 100;

export function truncateEventDescription(description: string | null | undefined): string {
  const value = (description ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= EVENT_TLDR_MAX_LENGTH) return value;
  return `${value.slice(0, EVENT_TLDR_MAX_LENGTH - 1).trimEnd()}…`;
}

export function getEventTldr(
  tldrSummary: string | null | undefined,
  description: string | null | undefined,
): string {
  const summary = tldrSummary?.replace(/\s+/g, " ").trim();
  return summary || truncateEventDescription(description);
}
