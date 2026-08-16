import { describe, it, expect } from "vitest";
import {
  parseAndValidateRosterCsv,
  batchProcessRosterImport,
  exportRosterToCsv,
  DEFAULT_ROSTER_BATCH_SIZE,
  type RosterImportRow,
  type RosterMember,
} from "./clubRosterImport";

describe("Club Roster CSV Import/Export (#3177)", () => {
  describe("Client-Side CSV Parser & Line-by-Line Validation", () => {
    it("parses valid CSV text into structured roster import rows", () => {
      const validCsv = `Email,Role
alex@university.edu,President
jordan@university.edu,Treasurer`;

      const result = parseAndValidateRosterCsv(validCsv);

      expect(result.valid).toBe(true);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].email).toBe("alex@university.edu");
      expect(result.rows[0].role).toBe("President");
    });

    it("flags missing required 'Email' header column", () => {
      const missingHeaderCsv = `Name,Role
Alex,President`;

      const result = parseAndValidateRosterCsv(missingHeaderCsv);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Missing required header column: "Email"');
    });

    it("flags exact row number for invalid email format (e.g. Row 3)", () => {
      const malformedCsv = `Email,Role
alex@university.edu,Member
invalid-email-address,Vice President
jordan@university.edu,Treasurer`;

      const result = parseAndValidateRosterCsv(malformedCsv);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].message).toContain(
        "Row 3: Invalid email format (invalid-email-address).",
      );
    });
  });

  describe("Rate-Limit Batching Engine (20-Batch)", () => {
    it("splits 200 roster rows into 10 batches of 20 to respect rate limits", () => {
      const rows: RosterImportRow[] = Array.from({ length: 200 }, (_, i) => ({
        email: `member${i}@university.edu`,
        role: "Member",
      }));

      const batches = batchProcessRosterImport(rows, 20);

      expect(batches.length).toBe(10);
      expect(batches[0].length).toBe(20);
      expect(batches[9].length).toBe(20);
    });

    it("enforces default batch size constant of 20", () => {
      expect(DEFAULT_ROSTER_BATCH_SIZE).toBe(20);
    });
  });

  describe("Roster Export to CSV", () => {
    it("formats club member roster into downloadable CSV format", () => {
      const members: RosterMember[] = [
        {
          id: "m_1",
          name: "Taylor Swift",
          email: "taylor@university.edu",
          role: "President",
          status: "Approved",
          joinedAt: "2026-08-15T10:00:00Z",
        },
      ];

      const csv = exportRosterToCsv(members);

      expect(csv).toContain("Full Name,Email,Role,Status,Joined Date");
      expect(csv).toContain('"Taylor Swift"');
      expect(csv).toContain('"taylor@university.edu"');
      expect(csv).toContain('"President"');
    });
  });
});
