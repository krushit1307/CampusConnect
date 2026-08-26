export interface SignedTicketPayload {
  ticketId: string;
  ownerId: string;
  eventId: string;
  issuedAt: number;
  signature: string;
}

export interface TicketTransferRecord {
  transferId: string;
  ticketId: string;
  senderId: string;
  recipientEmail: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  createdAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
}

export const TRANSFER_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Generates a mock HMAC/cryptographic signature string for a ticket payload.
 */
export function generateTicketSignature(
  ticketId: string,
  ownerId: string,
  eventId: string,
  secretKey = "campus_connect_secret",
): string {
  const content = `${ticketId}:${ownerId}:${eventId}:${secretKey}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `sig_${Math.abs(hash).toString(16)}`;
}

/**
 * Verifies if a scanned ticket signature matches current ticket ownership.
 */
export function verifyTicketSignature(
  payload: SignedTicketPayload,
  currentOwnerId: string,
): boolean {
  if (payload.ownerId !== currentOwnerId) {
    return false; // Old QR code from previous owner fails validation
  }

  const expectedSignature = generateTicketSignature(
    payload.ticketId,
    payload.ownerId,
    payload.eventId,
  );

  return payload.signature === expectedSignature;
}

/**
 * Checks if a pending ticket transfer request has expired (24-hour limit).
 */
export function isTransferExpired(
  record: TicketTransferRecord,
  nowMs: number = Date.now(),
): boolean {
  return nowMs >= record.expiresAt;
}

/**
 * Initiates ticket transfer into escrow state.
 */
export function createTransferEscrow(
  ticketId: string,
  senderId: string,
  recipientEmail: string,
  nowMs: number = Date.now(),
): TicketTransferRecord {
  return {
    transferId: `tr_${Math.random().toString(36).substring(2, 9)}`,
    ticketId,
    senderId,
    recipientEmail,
    status: "PENDING",
    createdAt: nowMs,
    expiresAt: nowMs + TRANSFER_EXPIRATION_MS,
  };
}
