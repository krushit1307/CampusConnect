import { describe, it, expect } from "vitest";
import {
  batchGoogleSheetsSync,
  formatRsvpRowForSheet,
  isGoogleTokenValid,
  type RsvpSyncItem,
} from "./googleSheetsSync";

describe("Google Sheets Event Analytics Sync Engine (#3012)", () => {
  it("batches queued RSVP sync items into groups of 50 to prevent rate limits", () => {
    // Generate 120 mock RSVP items
    const items: RsvpSyncItem[] = Array.from({ length: 120 }, (_, i) => ({
      id: `q_${i}`,
      eventId: "evt_1",
      rsvpId: `rsvp_${i}`,
      userName: `Student ${i}`,
      userEmail: `student${i}@university.edu`,
      ticketType: "VIP",
      status: "going",
      updatedAt: "2026-08-12T10:00:00Z",
    }));

    const batches = batchGoogleSheetsSync(items, 50);

    expect(batches.length).toBe(3);
    expect(batches[0].length).toBe(50);
    expect(batches[1].length).toBe(50);
    expect(batches[2].length).toBe(20);
  });

  it("formats RSVP record into Google Sheets row array tuple", () => {
    const item: RsvpSyncItem = {
      id: "q_1",
      eventId: "evt_1",
      rsvpId: "rsvp_1",
      userName: "Jane Doe",
      userEmail: "jane.doe@university.edu",
      ticketType: "Early Bird",
      status: "cancelled",
      updatedAt: "2026-08-12T12:00:00Z",
    };

    const row = formatRsvpRowForSheet(item);

    expect(row[0]).toBe("Jane Doe");
    expect(row[1]).toBe("jane.doe@university.edu");
    expect(row[2]).toBe("Early Bird");
    expect(row[3]).toBe("Canceled");
    expect(row[4]).toBe("2026-08-12T12:00:00.000Z");
  });

  it("validates OAuth token expiration and flags re-authentication requirement", () => {
    const now = new Date("2026-08-12T12:00:00Z");

    const validExp = new Date("2026-08-12T14:00:00Z").toISOString();
    const expiredExp = new Date("2026-08-12T10:00:00Z").toISOString();

    const validCheck = isGoogleTokenValid(validExp, now);
    expect(validCheck.isValid).toBe(true);
    expect(validCheck.needsReauth).toBe(false);

    const expiredCheck = isGoogleTokenValid(expiredExp, now);
    expect(expiredCheck.isValid).toBe(false);
    expect(expiredCheck.needsReauth).toBe(true);
    expect(expiredCheck.message).toContain("re-authenticate");
  });
});
