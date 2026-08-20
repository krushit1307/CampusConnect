export interface CachedGuestRecord {
  rsvpId: string;
  eventId: string;
  userId: string;
  userName: string;
  ticketSignature: string; // Cryptographic signature to verify fake tickets offline
  status: "attending" | "attended";
  checkedInAt?: string;
}

export interface QueuedOfflineCheckIn {
  rsvpId: string;
  checkedInAt: string;
  deviceId: string;
}

export interface VerificationResult {
  isValid: boolean;
  isAlreadyCheckedIn: boolean;
  guest?: CachedGuestRecord;
  reason?: string;
}

/**
 * Verifies ticket signature offline against local guest list cache.
 */
export function verifyTicketOffline(
  ticketSignature: string,
  localGuestList: CachedGuestRecord[],
): VerificationResult {
  const match = localGuestList.find((g) => g.ticketSignature === ticketSignature);

  if (!match) {
    return {
      isValid: false,
      isAlreadyCheckedIn: false,
      reason: "Invalid ticket signature. Not found in offline guest list.",
    };
  }

  if (match.status === "attended") {
    return {
      isValid: true,
      isAlreadyCheckedIn: true,
      guest: match,
      reason: `Already checked in at ${match.checkedInAt || "earlier time"}.`,
    };
  }

  return {
    isValid: true,
    isAlreadyCheckedIn: false,
    guest: match,
  };
}

/**
 * Records local offline check-in mutation, updates local cache, and pushes to queue array.
 */
export function recordOfflineCheckIn(
  rsvpId: string,
  deviceId: string,
  localGuestList: CachedGuestRecord[],
  pendingQueue: QueuedOfflineCheckIn[],
  nowIso: string = new Date().toISOString(),
): {
  updatedGuestList: CachedGuestRecord[];
  updatedQueue: QueuedOfflineCheckIn[];
} {
  const updatedGuestList = localGuestList.map((g) => {
    if (g.rsvpId === rsvpId) {
      return {
        ...g,
        status: "attended" as const,
        checkedInAt: nowIso,
      };
    }
    return g;
  });

  const newQueueItem: QueuedOfflineCheckIn = {
    rsvpId,
    checkedInAt: nowIso,
    deviceId,
  };

  const updatedQueue = [...pendingQueue, newQueueItem];

  return { updatedGuestList, updatedQueue };
}

/**
 * Prepares payload batch to flush to Supabase backend upon network reconnection.
 */
export function prepareSyncBatchPayload(queue: QueuedOfflineCheckIn[]): {
  batchSize: number;
  payload: QueuedOfflineCheckIn[];
} {
  return {
    batchSize: queue.length,
    payload: [...queue],
  };
}
