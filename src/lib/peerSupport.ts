export const PEER_SUPPORT_LOBBY = "peer-support:lobby";
export const PEER_SUPPORT_MATCH_TIMEOUT_MS = 90_000;
export const PEER_SUPPORT_LISTENER_CONFIRM_TIMEOUT_MS = 15_000;
export const MAX_PEER_SUPPORT_MESSAGE_LENGTH = 2_000;

export type PeerSupportRole = "requester" | "listener";

export type PeerSupportPayload =
  | {
      type: "request";
      requestId: string;
      requesterId: string;
      createdAt: number;
    }
  | {
      type: "accept";
      requestId: string;
      listenerId: string;
      acceptedAt: number;
    }
  | {
      type: "matched";
      requestId: string;
      roomId: string;
      requesterId: string;
      listenerId: string;
    }
  | {
      type: "cancel";
      requestId: string;
      senderId: string;
    }
  | {
      type: "hello";
      roomId: string;
      senderId: string;
      publicKey: string;
    }
  | {
      type: "chat";
      roomId: string;
      senderId: string;
      ciphertext: string;
      iv: string;
      sentAt: number;
    }
  | {
      type: "close";
      roomId: string;
      senderId: string;
    };

export type PeerSupportChatMessage = {
  id: string;
  body: string;
  mine: boolean;
};

export function createEphemeralId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildPeerSupportRoomName(roomId: string): string {
  return `peer-support:room:${roomId}`;
}

function isShortString(value: unknown, maxLength = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isPeerSupportPayload(value: unknown): value is PeerSupportPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (!isShortString(payload.type, 16)) return false;

  switch (payload.type) {
    case "request":
      return (
        isShortString(payload.requestId) &&
        isShortString(payload.requesterId) &&
        typeof payload.createdAt === "number"
      );
    case "accept":
      return (
        isShortString(payload.requestId) &&
        isShortString(payload.listenerId) &&
        typeof payload.acceptedAt === "number"
      );
    case "matched":
      return (
        isShortString(payload.requestId) &&
        isShortString(payload.roomId) &&
        isShortString(payload.requesterId) &&
        isShortString(payload.listenerId)
      );
    case "cancel":
      return isShortString(payload.requestId) && isShortString(payload.senderId);
    case "hello":
      return (
        isShortString(payload.roomId) &&
        isShortString(payload.senderId) &&
        isShortString(payload.publicKey, 2_000)
      );
    case "chat":
      return (
        isShortString(payload.roomId) &&
        isShortString(payload.senderId) &&
        isShortString(payload.ciphertext, 20_000) &&
        isShortString(payload.iv, 128) &&
        typeof payload.sentAt === "number"
      );
    case "close":
      return isShortString(payload.roomId) && isShortString(payload.senderId);
    default:
      return false;
  }
}
