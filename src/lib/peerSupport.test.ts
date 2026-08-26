import { describe, expect, it } from "vitest";

import {
  buildPeerSupportRoomName,
  createEphemeralId,
  isPeerSupportPayload,
  MAX_PEER_SUPPORT_MESSAGE_LENGTH,
} from "./peerSupport";

describe("peer support protocol", () => {
  it("creates opaque identifiers and deterministic room names", () => {
    const id = createEphemeralId();
    expect(id).toMatch(/^[a-f0-9-]{32,36}$/i);
    expect(buildPeerSupportRoomName("room-123")).toBe("peer-support:room:room-123");
  });

  it("accepts only the supported broadcast payload shapes", () => {
    expect(
      isPeerSupportPayload({
        type: "request",
        requestId: "request-1",
        requesterId: "participant-1",
        createdAt: Date.now(),
      }),
    ).toBe(true);
    expect(
      isPeerSupportPayload({
        type: "chat",
        roomId: "room-1",
        senderId: "participant-1",
        ciphertext: "ciphertext",
        iv: "iv",
        sentAt: Date.now(),
      }),
    ).toBe(true);
    expect(
      isPeerSupportPayload({
        type: "chat",
        roomId: "room-1",
        senderId: "participant-1",
        ciphertext: "x".repeat(20_001),
        iv: "iv",
        sentAt: Date.now(),
      }),
    ).toBe(false);
  });

  it("keeps the message limit shared with the UI", () => {
    expect(MAX_PEER_SUPPORT_MESSAGE_LENGTH).toBe(2_000);
    expect(
      isPeerSupportPayload({ type: "close", roomId: "room-1", senderId: "participant-1" }),
    ).toBe(true);
    expect(isPeerSupportPayload({ type: "close", roomId: "room-1", senderId: "" })).toBe(false);
  });
});
