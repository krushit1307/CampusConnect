import { describe, expect, it } from "vitest";
import {
  SAR_DEADLINE_DAYS,
  SAR_DOWNLOAD_TTL_SECONDS,
  SAR_SOURCE_TABLES,
  buildGdprSarDocument,
  buildGdprSarReadyEmail,
  decryptSarArchive,
  encryptSarArchive,
  sarDueBy,
  serializeSarArchive,
} from "./gdprSarArchive";

describe("GDPR SAR archive (#4733)", () => {
  it("builds a structured JSON archive from the required tables", () => {
    const doc = buildGdprSarDocument("user-1", {
      users: [{ id: "user-1", email: "student@campus.edu" }],
      event_rsvps: [{ id: "rsvp-1" }],
      payments: [{ id: "pay-1" }],
      chat_logs: [{ id: "chat-1" }],
      support_tickets: [{ id: "ticket-1" }],
      reviews: [{ id: "review-1" }],
    });

    expect(doc.type).toBe("subject_access_request");
    expect(doc.regulation).toBe("GDPR/CCPA");
    expect(SAR_SOURCE_TABLES.every((table) => Array.isArray(doc[table]))).toBe(true);
    expect(doc.users).toHaveLength(1);
    expect(JSON.parse(serializeSarArchive(doc)).event_rsvps).toEqual([{ id: "rsvp-1" }]);
  });

  it("encrypts the archive and emails a 30-day download link", () => {
    const requestedAt = new Date("2026-08-28T00:00:00.000Z");
    expect(sarDueBy(requestedAt).toISOString()).toBe("2026-09-27T00:00:00.000Z");
    expect(SAR_DEADLINE_DAYS).toBe(30);
    expect(SAR_DOWNLOAD_TTL_SECONDS).toBe(30 * 24 * 60 * 60);

    const plaintext = serializeSarArchive(buildGdprSarDocument("user-1", {}));
    const { key, blob } = encryptSarArchive(plaintext);
    expect(decryptSarArchive(blob, key)).toBe(plaintext);

    const expiresAt = sarDueBy(requestedAt);
    const email = buildGdprSarReadyEmail(
      "https://files.example/archive",
      expiresAt,
      key.toString("hex"),
    );
    expect(email.html).toContain("https://files.example/archive");
    expect(email.html).toContain("30 days");
    expect(email.html).toContain(key.toString("hex"));
  });
});
