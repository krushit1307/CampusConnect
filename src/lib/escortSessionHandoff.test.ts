import { describe, it, expect } from "vitest";
import {
  generateEscortHandoffToken,
  validateAndTransferBroadcasterRole,
  EscortSession,
} from "./escortSessionHandoff";

describe("Build Real-Time Campus Safety Escort Handoff Suite (#4487)", () => {
  const activeSession: EscortSession = {
    id: "sess_escort_101",
    studentUserId: "usr_student_alice",
    activeOfficerId: "usr_officer_bob",
    channelName: "safety_escort_channel_101",
    status: "in_progress",
  };

  const departingOfficerId = "usr_officer_bob";
  const relievingOfficerId = "usr_officer_charlie";

  it("generates a 32-char hex handoff token and JSON QR code payload with 5-minute expiry", () => {
    const payload = generateEscortHandoffToken(
      activeSession,
      departingOfficerId,
      relievingOfficerId,
    );

    expect(payload.handoffToken).toMatch(/^[a-f0-9]{32}$/);
    expect(payload.sessionId).toBe("sess_escort_101");

    const parsedQr = JSON.parse(payload.qrPayload);
    expect(parsedQr.session).toBe("sess_escort_101");
    expect(parsedQr.channel).toBe("safety_escort_channel_101");

    expect(new Date(payload.expiresAtIso).getTime()).toBeGreaterThan(Date.now());
  });

  it("transfers broadcaster role to relieving officer upon valid token redemption", () => {
    const payload = generateEscortHandoffToken(
      activeSession,
      departingOfficerId,
      relievingOfficerId,
    );

    const result = validateAndTransferBroadcasterRole(
      payload,
      payload.handoffToken,
      relievingOfficerId,
      activeSession,
    );

    expect(result.isTransferred).toBe(true);
    expect(result.newBroadcasterOfficerId).toBe("usr_officer_charlie");
    expect(result.channelName).toBe("safety_escort_channel_101");
    expect(result.statusMessage).toContain("seamlessly transferred");
  });

  it("rejects handoff if token is expired, invalid, or submitted by unauthorized officer", () => {
    const payload = generateEscortHandoffToken(
      activeSession,
      departingOfficerId,
      relievingOfficerId,
    );

    // Invalid token
    const badTokenResult = validateAndTransferBroadcasterRole(
      payload,
      "wrong_token_123",
      relievingOfficerId,
      activeSession,
    );
    expect(badTokenResult.isTransferred).toBe(false);

    // Unauthorized officer
    const badOfficerResult = validateAndTransferBroadcasterRole(
      payload,
      payload.handoffToken,
      "usr_unauthorized_officer",
      activeSession,
    );
    expect(badOfficerResult.isTransferred).toBe(false);

    // Expired token
    const futureNow = new Date(Date.now() + 10 * 60 * 1000); // 10 mins later
    const expiredResult = validateAndTransferBroadcasterRole(
      payload,
      payload.handoffToken,
      relievingOfficerId,
      activeSession,
      futureNow,
    );
    expect(expiredResult.isTransferred).toBe(false);
    expect(expiredResult.statusMessage).toContain("Token has expired");
  });
});
