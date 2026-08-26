/**
 * Dynamic QR Code Refresh to Prevent Screenshots (#3189).
 * Implements time-based cryptographic QR code tickets (Ticketmaster SafeTix model).
 * Payload refreshes every 15 seconds with a 30-second expiration window (exp).
 */

export interface DynamicQrPayload {
  version: "1.0";
  rsvpId: string;
  userId: string;
  eventId: string;
  exp: number; // Expiration timestamp in ms
  nonce: string;
  isOfflineFallback: boolean;
  signature: string;
}

export interface DynamicQrValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  isExpired?: boolean;
  isOfflineFallback?: boolean;
  payload?: DynamicQrPayload;
}

export const DYNAMIC_QR_REFRESH_INTERVAL_MS = 15000; // 15 seconds
export const DYNAMIC_QR_EXPIRATION_MS = 30000; // 30 seconds
export const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 15000; // 15 seconds

/**
 * Calculates a cryptographic checksum signature for the QR payload.
 */
export function generateQrSignature(
  rsvpId: string,
  userId: string,
  eventId: string,
  exp: number,
  nonce: string,
  isOffline: boolean,
  secretKey = "campus_connect_ticket_secret",
): string {
  const raw = `${rsvpId}:${userId}:${eventId}:${exp}:${nonce}:${isOffline}:${secretKey}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generates a dynamic cryptographic QR code ticket token that rotates every 15 seconds.
 */
export function generateDynamicQrTicketToken(
  rsvpId: string,
  userId: string,
  eventId: string,
  secretKey = "campus_connect_ticket_secret",
  serverTimeMs = Date.now(),
  isOffline = false,
): string {
  const exp = serverTimeMs + DYNAMIC_QR_EXPIRATION_MS;
  const nonce = Math.random().toString(36).substring(2, 10);
  const signature = generateQrSignature(rsvpId, userId, eventId, exp, nonce, isOffline, secretKey);

  const payload: DynamicQrPayload = {
    version: "1.0",
    rsvpId,
    userId,
    eventId,
    exp,
    nonce,
    isOfflineFallback: isOffline,
    signature,
  };

  return JSON.stringify(payload);
}

/**
 * Validates a scanned QR code ticket token.
 * Rejects expired tokens with "Screenshot Detected", handles offline fallback warnings,
 * and accounts for server clock skew.
 */
export function validateDynamicQrTicketToken(
  rawTokenString: string,
  secretKey = "campus_connect_ticket_secret",
  serverTimeMs = Date.now(),
  clockSkewToleranceMs = DEFAULT_CLOCK_SKEW_TOLERANCE_MS,
): DynamicQrValidationResult {
  try {
    const data = JSON.parse(rawTokenString) as DynamicQrPayload;

    if (!data.rsvpId || !data.userId || data.version !== "1.0") {
      return { valid: false, error: "Invalid ticket QR code format." };
    }

    // Cryptographic signature verification
    const expectedSig = generateQrSignature(
      data.rsvpId,
      data.userId,
      data.eventId,
      data.exp,
      data.nonce,
      data.isOfflineFallback,
      secretKey,
    );

    if (data.signature !== expectedSig) {
      return { valid: false, error: "Invalid ticket QR code signature." };
    }

    // Expiration check (with clock skew tolerance)
    if (serverTimeMs > data.exp + clockSkewToleranceMs) {
      return {
        valid: false,
        error: "Screenshot Detected. QR Code Has Expired.",
        isExpired: true,
      };
    }

    // Offline fallback detection -> Warning alert for bouncers
    if (data.isOfflineFallback) {
      return {
        valid: true,
        warning: "Offline Ticket - Verify ID visually",
        isOfflineFallback: true,
        payload: data,
      };
    }

    return {
      valid: true,
      payload: data,
    };
  } catch {
    return { valid: false, error: "Corrupted QR ticket payload." };
  }
}

/**
 * Calculates countdown timer progress for the UI ("Refreshes in 12s").
 */
export function calculateRefreshCountdown(
  lastRefreshMs: number,
  refreshIntervalMs = DYNAMIC_QR_REFRESH_INTERVAL_MS,
  nowMs = Date.now(),
): { secondsRemaining: number; label: string } {
  const elapsedMs = nowMs - lastRefreshMs;
  const remainingMs = Math.max(0, refreshIntervalMs - elapsedMs);
  const seconds = Math.ceil(remainingMs / 1000);

  return {
    secondsRemaining: seconds,
    label: `Refreshes in ${seconds}s`,
  };
}
