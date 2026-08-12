/**
 * Google Sheets Event Analytics Sync Engine (#3012).
 * Implements RSVP row formatting, OAuth token validation, and batching queue logic
 * to prevent Google Sheets API rate limit failures (60 requests/min).
 */

export interface RsvpSyncItem {
  id: string;
  eventId: string;
  rsvpId: string;
  userName: string;
  userEmail: string;
  ticketType?: string;
  status: string; // 'going', 'attended', 'cancelled'
  updatedAt: string;
}

export const GOOGLE_SHEETS_MAX_BATCH_SIZE = 50;

/**
 * Formats an RSVP record into a Google Sheets row tuple array.
 * Output shape: [Full Name, Email, Ticket Type, Status, Timestamp]
 */
export function formatRsvpRowForSheet(item: RsvpSyncItem): string[] {
  const formattedStatus =
    item.status.toLowerCase() === "cancelled" || item.status.toLowerCase() === "canceled"
      ? "Canceled"
      : item.status.charAt(0).toUpperCase() + item.status.slice(1);

  return [
    item.userName || "Anonymous Student",
    item.userEmail || "",
    item.ticketType || "General Admission",
    formattedStatus,
    new Date(item.updatedAt).toISOString(),
  ];
}

/**
 * Batches queued RSVP sync items into groups of up to `maxBatchSize` (default 50)
 * to comply with Google Sheets API rate limits.
 */
export function batchGoogleSheetsSync(
  queueItems: RsvpSyncItem[],
  maxBatchSize = GOOGLE_SHEETS_MAX_BATCH_SIZE,
): RsvpSyncItem[][] {
  if (!queueItems || queueItems.length === 0) {
    return [];
  }

  const batches: RsvpSyncItem[][] = [];
  for (let i = 0; i < queueItems.length; i += maxBatchSize) {
    batches.push(queueItems.slice(i, i + maxBatchSize));
  }

  return batches;
}

/**
 * Verifies Google OAuth token validity and flags expired tokens requiring re-authentication.
 */
export function isGoogleTokenValid(
  tokenExpiresAt?: string | number | null,
  now: Date = new Date(),
): { isValid: boolean; needsReauth: boolean; message: string } {
  if (!tokenExpiresAt) {
    return {
      isValid: false,
      needsReauth: true,
      message: "Google Workspace integration is not authenticated.",
    };
  }

  const expMs =
    typeof tokenExpiresAt === "number" ? tokenExpiresAt : new Date(tokenExpiresAt).getTime();
  const nowMs = now.getTime();

  // Flag if token has expired or expires within 60 seconds
  if (expMs - nowMs <= 60000) {
    return {
      isValid: false,
      needsReauth: true,
      message:
        "Google OAuth token has expired. Please re-authenticate your Google Workspace connection.",
    };
  }

  return {
    isValid: true,
    needsReauth: false,
    message: "Google Workspace token is valid.",
  };
}
