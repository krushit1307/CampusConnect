import { describe, it, expect } from "vitest";
import {
  verifyTicketOffline,
  recordOfflineCheckIn,
  prepareSyncBatchPayload,
  CachedGuestRecord,
  QueuedOfflineCheckIn,
} from "./offlineGuestListSync";

describe("Real-Time Guest List Offline Sync Suite (#3672)", () => {
  const sampleGuestList: CachedGuestRecord[] = [
    {
      rsvpId: "rsvp_1001",
      eventId: "evt_gala",
      userId: "usr_alice",
      userName: "Alice Smith",
      ticketSignature: "SIG_VALID_12345",
      status: "attending",
    },
    {
      rsvpId: "rsvp_1002",
      eventId: "evt_gala",
      userId: "usr_bob",
      userName: "Bob Jones",
      ticketSignature: "SIG_VALID_67890",
      status: "attended",
      checkedInAt: "2026-08-20T20:00:00Z",
    },
  ];

  it("verifies ticket cryptographic signature offline and detects already checked-in status", () => {
    // Valid unused ticket
    const validRes = verifyTicketOffline("SIG_VALID_12345", sampleGuestList);
    expect(validRes.isValid).toBe(true);
    expect(validRes.isAlreadyCheckedIn).toBe(false);
    expect(validRes.guest?.userName).toBe("Alice Smith");

    // Already checked in ticket
    const checkedInRes = verifyTicketOffline("SIG_VALID_67890", sampleGuestList);
    expect(checkedInRes.isValid).toBe(true);
    expect(checkedInRes.isAlreadyCheckedIn).toBe(true);

    // Fake / invalid signature
    const fakeRes = verifyTicketOffline("SIG_FAKE_99999", sampleGuestList);
    expect(fakeRes.isValid).toBe(false);
    expect(fakeRes.reason).toContain("Invalid ticket signature");
  });

  it("records offline check-in mutation locally and updates pending sync queue", () => {
    const queue: QueuedOfflineCheckIn[] = [];
    const result = recordOfflineCheckIn("rsvp_1001", "dev_scanner_1", sampleGuestList, queue);

    // Check local guest list updated
    const updatedAlice = result.updatedGuestList.find((g) => g.rsvpId === "rsvp_1001");
    expect(updatedAlice?.status).toBe("attended");
    expect(updatedAlice?.checkedInAt).toBeDefined();

    // Check queue updated
    expect(result.updatedQueue.length).toBe(1);
    expect(result.updatedQueue[0].rsvpId).toBe("rsvp_1001");
    expect(result.updatedQueue[0].deviceId).toBe("dev_scanner_1");
  });

  it("prepares sync batch payload for backend flushing when network reconnects", () => {
    const queue: QueuedOfflineCheckIn[] = [
      { rsvpId: "rsvp_1001", checkedInAt: "2026-08-20T21:00:00Z", deviceId: "dev_1" },
      { rsvpId: "rsvp_1003", checkedInAt: "2026-08-20T21:05:00Z", deviceId: "dev_1" },
    ];

    const batch = prepareSyncBatchPayload(queue);

    expect(batch.batchSize).toBe(2);
    expect(batch.payload.length).toBe(2);
    expect(batch.payload[0].rsvpId).toBe("rsvp_1001");
  });
});
