export interface InactiveAccountCandidate {
  lastSignInAt: string | null;
  createdAt: string;
  role: string;
}

export function isEligibleForInactivePurge(
  candidate: InactiveAccountCandidate,
  now: Date,
  inactivityYears = 4,
): boolean {
  if (!Number.isInteger(inactivityYears) || inactivityYears < 4) return false;

  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - inactivityYears);
  const lastActivity = candidate.lastSignInAt
    ? new Date(candidate.lastSignInAt)
    : new Date(candidate.createdAt);

  if (Number.isNaN(lastActivity.getTime())) return false;
  if (!(candidate.role.toLowerCase() === "student" || candidate.role.toLowerCase() === "user")) {
    return false;
  }

  return lastActivity < cutoff;
}

export function purgeSummaryMessage(summary: {
  dry_run: boolean;
  examined: number;
  anonymized: number;
  failed: number;
}): string {
  if (summary.dry_run) {
    return `Dry run identified ${summary.examined} inactive account${summary.examined === 1 ? "" : "s"}.`;
  }
  return `Anonymized ${summary.anonymized} inactive account${summary.anonymized === 1 ? "" : "s"}; ${summary.failed} failed.`;
}
