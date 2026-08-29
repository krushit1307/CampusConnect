export const TAG_ARCHIVAL_INACTIVITY_DAYS = 365;

export function isTagEligibleForArchive(lastUsedAt: Date | string, now = new Date()): boolean {
  const lastUsed = lastUsedAt instanceof Date ? lastUsedAt : new Date(lastUsedAt);
  if (Number.isNaN(lastUsed.getTime())) return false;
  const cutoff = new Date(now.getTime() - TAG_ARCHIVAL_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
  return lastUsed < cutoff;
}

export function isActiveTagStatus(status: string | null | undefined): boolean {
  return status === "active";
}
