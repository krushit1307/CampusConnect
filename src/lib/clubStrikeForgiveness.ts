export interface ClubProbationRecord {
  id: string;
  clubId: string;
  clubName: string;
  reason: string;
  status: "active" | "expunged" | "resolved";
  createdAtIso: string;
  expiresAtIso: string;
  presidentEmail?: string;
}

export interface ForgivenessResult {
  expungedCount: number;
  expungedRecords: ClubProbationRecord[];
  notificationsToSend: Array<{
    recipientEmail: string;
    subject: string;
    body: string;
  }>;
}

export const DEFAULT_PROBATION_DURATION_DAYS = 365;

/**
 * Calculates expiration timestamp (default 365 days from issuance).
 */
export function calculateStrikeExpiration(
  issuanceDate: Date = new Date(),
  durationDays = DEFAULT_PROBATION_DURATION_DAYS,
): string {
  const expiry = new Date(issuanceDate.getTime());
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry.toISOString();
}

/**
 * Evaluates whether a club probation strike has expired and qualifies for automated forgiveness.
 */
export function isStrikeExpired(expiresAtIso: string, currentTime: Date = new Date()): boolean {
  return currentTime >= new Date(expiresAtIso);
}

/**
 * Processes batch strike forgiveness and constructs president notification emails.
 */
export function processStrikeForgivenessBatch(
  records: ClubProbationRecord[],
  currentTime: Date = new Date(),
): ForgivenessResult {
  const expungedRecords: ClubProbationRecord[] = [];
  const notificationsToSend: ForgivenessResult["notificationsToSend"] = [];

  for (const rec of records) {
    if (rec.status === "active" && isStrikeExpired(rec.expiresAtIso, currentTime)) {
      const expunged: ClubProbationRecord = {
        ...rec,
        status: "expunged",
      };
      expungedRecords.push(expunged);

      if (rec.presidentEmail) {
        notificationsToSend.push({
          recipientEmail: rec.presidentEmail,
          subject: `Disciplinary Strike Expunged: ${rec.clubName}`,
          body: `Your club's past disciplinary strike ("${rec.reason}") has been expunged. ${rec.clubName} is back in good standing with full venue booking access.`,
        });
      }
    }
  }
  return {
    expungedCount: expungedRecords.length,
    expungedRecords,
    notificationsToSend,
  };
}
