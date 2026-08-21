import { describe, it, expect } from "vitest";
import {
  generateConnectQrPayload,
  parseConnectQrPayload,
  exportConnectionsToCsv,
  exportConnectionsToVCard,
  generateVCard,
  generatePayloadSignature,
  DEFAULT_SHARE_PERMISSIONS,
  QR_CODE_EXPIRATION_MS,
  type UserConnection,
} from "./digitalBusinessCard";

describe("Digital Business Card Exchange - Advanced Module (#3020)", () => {
  const secretKey = "test_secret_key";
  const nowMs = 1750000000000;

  describe("Cryptographic Anti-Spoofing & Expiration", () => {
    it("generates and verifies cryptographic anti-spoofing signatures", () => {
      const qrString = generateConnectQrPayload(
        "usr_99",
        "evt_1",
        DEFAULT_SHARE_PERMISSIONS,
        secretKey,
        nowMs,
      );
      const res = parseConnectQrPayload(qrString, secretKey, nowMs);

      expect(res.valid).toBe(true);
      expect(res.payload?.userId).toBe("usr_99");
      expect(res.payload?.eventId).toBe("evt_1");
    });

    it("rejects tampered QR payloads with invalid signatures", () => {
      const qrString = generateConnectQrPayload(
        "usr_99",
        "evt_1",
        DEFAULT_SHARE_PERMISSIONS,
        secretKey,
        nowMs,
      );
      const tamperedStr = qrString.replace("usr_99", "usr_attacker");

      const res = parseConnectQrPayload(tamperedStr, secretKey, nowMs);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("signature verification failed");
    });

    it("rejects expired QR codes past the 5-minute (300,000ms) window", () => {
      const pastTime = nowMs - QR_CODE_EXPIRATION_MS - 1000; // 5 minutes 1 second ago
      const qrString = generateConnectQrPayload(
        "usr_99",
        "evt_1",
        DEFAULT_SHARE_PERMISSIONS,
        secretKey,
        pastTime,
      );

      const res = parseConnectQrPayload(qrString, secretKey, nowMs);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("expired");
    });

    it("accepts valid QR codes within the 5-minute window", () => {
      const recentTime = nowMs - 120000; // 2 minutes ago
      const qrString = generateConnectQrPayload(
        "usr_99",
        "evt_1",
        DEFAULT_SHARE_PERMISSIONS,
        secretKey,
        recentTime,
      );

      const res = parseConnectQrPayload(qrString, secretKey, nowMs);
      expect(res.valid).toBe(true);
    });
  });

  describe("vCard (.vcf) Phone Contact Export", () => {
    it("formats a connection into standard vCard format", () => {
      const connection: UserConnection = {
        id: "conn_1",
        name: "Samantha Reed",
        email: "samantha@university.edu",
        linkedin: "https://linkedin.com/in/samanthareed",
        github: "https://github.com/samanthareed",
        phone: "+1-555-0199",
        eventName: "Tech Career Mixer",
        connectedAt: "2026-08-15T10:00:00Z",
      };

      const vcard = generateVCard(connection);

      expect(vcard).toContain("BEGIN:VCARD");
      expect(vcard).toContain("VERSION:3.0");
      expect(vcard).toContain("FN:Samantha Reed");
      expect(vcard).toContain("EMAIL;TYPE=INTERNET:samantha@university.edu");
      expect(vcard).toContain("TEL;TYPE=CELL:+1-555-0199");
      expect(vcard).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/samanthareed");
      expect(vcard).toContain("NOTE:Met at Tech Career Mixer");
      expect(vcard).toContain("END:VCARD");
    });

    it("exports multiple connections into a vCard bundle", () => {
      const connections: UserConnection[] = [
        { id: "c1", name: "User One", email: "one@test.com", connectedAt: "2026-08-15T10:00:00Z" },
        { id: "c2", name: "User Two", email: "two@test.com", connectedAt: "2026-08-15T10:00:00Z" },
      ];

      const bundle = exportConnectionsToVCard(connections);
      expect(bundle).toContain("FN:User One");
      expect(bundle).toContain("FN:User Two");
      expect(bundle).toContain("END:VCARD\n\nBEGIN:VCARD");
    });
  });

  describe("CSV Network Export", () => {
    it("formats user network connections into CSV format", () => {
      const connections: UserConnection[] = [
        {
          id: "conn_1",
          name: "Alex Smith",
          email: "alex@university.edu",
          linkedin: "https://linkedin.com/in/alexsmith",
          github: "https://github.com/alexsmith",
          eventName: "Fall Career Fair 2026",
          connectedAt: "2026-08-15T10:00:00Z",
        },
      ];

      const csv = exportConnectionsToCsv(connections);

      expect(csv).toContain("Full Name,Email,LinkedIn,GitHub");
      expect(csv).toContain('"Alex Smith"');
      expect(csv).toContain('"alex@university.edu"');
      expect(csv).toContain('"Fall Career Fair 2026"');
    });
  });
});
