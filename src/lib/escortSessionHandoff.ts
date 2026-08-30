import { randomBytes } from "crypto";

export interface EscortSession {
  id: string;
  studentUserId: string;
  activeOfficerId: string;
  channelName: string;
  status: "in_progress" | "handoff_pending" | "completed" | "cancelled";
}

export interface OfficerProfile {
  id: string;
  fullName: string;
  badgeNumber: string;
}

export interface HandoffTokenPayload {
  sessionId: string;
  departingOfficerId: string;
  relievingOfficerId: string;
  handoffToken: string;
  expiresAtIso: string;
  qrPayload: string;
}

export interface RoleTransferResult {
  isTransferred: boolean;
  channelName: string;
  newBroadcasterOfficerId: string;
  statusMessage: string;
}

export const HANDOFF_TOKEN_EXPIRY_MINUTES = 5;

/**
 * Generates a secure random handoff token and QR payload for officer session transfer.
 */
export function generateEscortHandoffToken(
  session: EscortSession,
  departingOfficerId: string,
  relievingOfficerId: string,
  expiryMinutes = HANDOFF_TOKEN_EXPIRY_MINUTES,
): HandoffTokenPayload {
  const rawToken = randomBytes(16).toString("hex");
  const expiresAtIso = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  const qrPayload = JSON.stringify({
    token: rawToken,
    session: session.id,
    channel: session.channelName,
  });

  return {
    sessionId: session.id,
    departingOfficerId,
    relievingOfficerId,
    handoffToken: rawToken,
    expiresAtIso,
    qrPayload,
  };
}

/**
 * Validates and transfers WebSocket broadcaster role to the relieving officer while preserving the live session.
 */
export function validateAndTransferBroadcasterRole(
  tokenPayload: HandoffTokenPayload,
  submittedToken: string,
  claimingOfficerId: string,
  session: EscortSession,
  currentTime: Date = new Date(),
): RoleTransferResult {
  if (currentTime > new Date(tokenPayload.expiresAtIso)) {
    return {
      isTransferred: false,
      channelName: session.channelName,
      newBroadcasterOfficerId: session.activeOfficerId,
      statusMessage: "Handoff failed: Token has expired.",
    };
  }

  if (submittedToken.trim() !== tokenPayload.handoffToken) {
    return {
      isTransferred: false,
      channelName: session.channelName,
      newBroadcasterOfficerId: session.activeOfficerId,
      statusMessage: "Handoff failed: Invalid token.",
    };
  }

  if (claimingOfficerId !== tokenPayload.relievingOfficerId) {
    return {
      isTransferred: false,
      channelName: session.channelName,
      newBroadcasterOfficerId: session.activeOfficerId,
      statusMessage: "Handoff failed: Unauthorized officer ID.",
    };
  }

  return {
    isTransferred: true,
    channelName: session.channelName,
    newBroadcasterOfficerId: claimingOfficerId,
    statusMessage: "Broadcaster role seamlessly transferred. Student live map tracking active.",
  };
}
