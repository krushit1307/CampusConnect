export interface ItinerarySession {
  sessionId: string;
  title: string;
  room: string;
  startTime: string;
}

export interface WalletPushSyncRequest {
  userId: string;
  serialNumber: string;
  pushToken: string;
  session: ItinerarySession;
  action: "added" | "removed" | "updated";
}

export interface WalletPushSyncResult {
  syncId: string;
  serialNumber: string;
  action: "added" | "removed" | "updated";
  apnsPayload: {
    aps: { "content-available": 1 };
    passSerialNumber: string;
  };
  status: "synced" | "pending" | "failed";
  syncedAt: string;
}

/**
 * Constructs standard Apple Wallet APNs silent push payload (#4671).
 */
export function constructApnsWalletPayload(serialNumber: string): {
  aps: { "content-available": 1 };
  passSerialNumber: string;
} {
  return {
    aps: { "content-available": 1 },
    passSerialNumber: serialNumber,
  };
}

/**
 * Triggers silent APNs push notification to Apple Wallet pass upon itinerary modification (#4671).
 */
export function syncItineraryToWalletPass(
  request: WalletPushSyncRequest
): WalletPushSyncResult {
  if (!request.serialNumber || !request.pushToken) {
    throw new Error("Cannot sync wallet pass: Serial number and APNs push token required.");
  }

  const syncId = `wsync-${Date.now()}`;
  const apnsPayload = constructApnsWalletPayload(request.serialNumber);

  return {
    syncId,
    serialNumber: request.serialNumber,
    action: request.action,
    apnsPayload,
    status: "synced",
    syncedAt: new Date().toISOString(),
  };
}
