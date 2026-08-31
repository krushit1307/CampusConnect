import { describe, it, expect } from "vitest";
import {
  constructApnsWalletPayload,
  syncItineraryToWalletPass,
  WalletPushSyncRequest,
} from "./walletAgendaPushSync";

describe("Event Schedule Custom Agenda Push Sync Utility (#4671)", () => {
  const sampleRequest: WalletPushSyncRequest = {
    userId: "u-student-101",
    serialNumber: "pass_user101_evt2026",
    pushToken: "apns_token_abc123xyz789",
    session: {
      sessionId: "s-keynote-1",
      title: "AI & Innovation Keynote",
      room: "Main Auditorium Hall A",
      startTime: "10:00 AM",
    },
    action: "removed",
  };

  it("constructs standard Apple Wallet APNs silent push payload", () => {
    const payload = constructApnsWalletPayload("pass_user101_evt2026");
    expect(payload.aps["content-available"]).toBe(1);
    expect(payload.passSerialNumber).toBe("pass_user101_evt2026");
  });

  it("triggers silent APNs push notification upon itinerary modification", () => {
    const result = syncItineraryToWalletPass(sampleRequest);

    expect(result.status).toBe("synced");
    expect(result.action).toBe("removed");
    expect(result.serialNumber).toBe("pass_user101_evt2026");
    expect(result.apnsPayload.aps["content-available"]).toBe(1);
  });
});
