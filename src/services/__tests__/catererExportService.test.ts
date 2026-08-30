import { describe, it, expect } from "vitest";
import {
  isSevereTag,
  scrubPiiFromNote,
  aggregateDietaryData,
  generateCatererCsvExport,
  generateCatererJsonManifest,
  generatePrintableSummaryText,
  RawRsvpDietaryData,
} from "../catererExportService";

describe("Caterer Export Service (Dynamic Dietary Restrictions)", () => {
  describe("isSevereTag", () => {
    it("identifies severe / life-threatening allergy tags", () => {
      expect(isSevereTag("peanut_severe")).toBe(true);
      expect(isSevereTag("anaphylaxis")).toBe(true);
      expect(isSevereTag("celiac_severe")).toBe(true);
      expect(isSevereTag("severe-shellfish")).toBe(true);
    });

    it("returns false for standard dietary restrictions", () => {
      expect(isSevereTag("vegetarian")).toBe(false);
      expect(isSevereTag("vegan")).toBe(false);
      expect(isSevereTag("halal")).toBe(false);
      expect(isSevereTag("kosher")).toBe(false);
    });
  });

  describe("scrubPiiFromNote", () => {
    it("redacts emails, phone numbers, and UUIDs from notes", () => {
      const rawNote = "Contact john.doe@university.edu or (555) 019-2831 for details. Ref: 123e4567-e89b-12d3-a456-426614174000";
      const scrubbed = scrubPiiFromNote(rawNote);

      expect(scrubbed).not.toContain("john.doe@university.edu");
      expect(scrubbed).not.toContain("(555) 019-2831");
      expect(scrubbed).not.toContain("123e4567-e89b-12d3-a456-426614174000");
      expect(scrubbed).toContain("[REDACTED EMAIL]");
      expect(scrubbed).toContain("[REDACTED PHONE]");
      expect(scrubbed).toContain("[REDACTED ID]");
    });
  });

  describe("aggregateDietaryData", () => {
    it("correctly aggregates dietary counts and anonymizes PII", () => {
      const mockRsvps: RawRsvpDietaryData[] = [
        {
          user_id: "user-111",
          attendee_name: "Alice Smith",
          email: "alice@example.com",
          dietary_tags: ["vegetarian"],
        },
        {
          user_id: "user-222",
          attendee_name: "Bob Jones",
          email: "bob@example.com",
          dietary_tags: ["vegetarian", "gluten-free"],
        },
        {
          user_id: "user-333",
          attendee_name: "Charlie Brown",
          email: "charlie@example.com",
          dietary_tags: ["peanut_severe"],
          dietary_notes: "Severe peanut allergy! Call charlie@example.com if needed.",
        },
        {
          user_id: "user-444",
          attendee_name: "David Miller",
          email: "david@example.com",
          dietary_tags: [],
        },
      ];

      const manifest = aggregateDietaryData(mockRsvps, "Spring Banquet 2026", "evt-999");

      expect(manifest.eventTitle).toBe("Spring Banquet 2026");
      expect(manifest.totalRsvps).toBe(4);
      expect(manifest.privacyGuarantee).toBe("STRICTLY_ANONYMIZED_ZERO_PII");

      // Verify counts
      const vegCount = manifest.summaryCounts.find((s) => s.tag.toLowerCase() === "vegetarian");
      expect(vegCount?.count).toBe(2);
      expect(vegCount?.percentage).toBe(50); // 2 out of 4 RSVPs

      // Verify severe allergy anonymization
      expect(manifest.severeAllergies.length).toBe(1);
      const severe = manifest.severeAllergies[0];
      expect(severe.attendeeLabel).toBe("Attendee #1");
      expect(severe.note).not.toContain("Charlie Brown");
      expect(severe.note).not.toContain("charlie@example.com");
      expect(severe.note).toContain("[REDACTED EMAIL]");
    });
  });

  describe("Export format generators", () => {
    const sampleRsvps: RawRsvpDietaryData[] = [
      {
        user_id: "u-1",
        dietary_tags: ["vegan"],
      },
      {
        user_id: "u-2",
        dietary_tags: ["nut_severe"],
        dietary_notes: "Contact test@school.edu",
      },
    ];

    const manifest = aggregateDietaryData(sampleRsvps, "Tech Conference", "evt-tech");

    it("generates valid CSV export with no raw PII", () => {
      const csv = generateCatererCsvExport(manifest);

      expect(csv).toContain('"CATERER DIETARY MANIFEST — STRICTLY ANONYMIZED"');
      expect(csv).toContain('"Tech Conference"');
      expect(csv).toContain('"Vegan",1,50%');
      expect(csv).toContain('"Attendee #1"');
      expect(csv).not.toContain("test@school.edu");
    });

    it("generates valid JSON manifest string", () => {
      const jsonStr = generateCatererJsonManifest(manifest);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.eventTitle).toBe("Tech Conference");
      expect(parsed.privacyGuarantee).toBe("STRICTLY_ANONYMIZED_ZERO_PII");
    });

    it("generates readable printable summary text", () => {
      const printable = generatePrintableSummaryText(manifest);

      expect(printable).toContain("CATERER DIETARY MANIFEST — KITCHEN SUMMARY");
      expect(printable).toContain("Tech Conference");
      expect(printable).toContain("CRITICAL SEVERE ALLERGY WARNINGS:");
    });
  });
});
