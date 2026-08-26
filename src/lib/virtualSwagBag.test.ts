import { describe, it, expect } from "vitest";
import { isAttendanceVerified, formatSwagExpiration } from "./virtualSwagBag";

describe("Virtual Swag Bag Feature (#3008)", () => {
  describe("Attendance Gating Check", () => {
    it("returns true strictly for 'attended' status", () => {
      expect(isAttendanceVerified("attended")).toBe(true);
      expect(isAttendanceVerified("ATTENDED")).toBe(true);
    });

    it("returns false for non-attended RSVP statuses (e.g. 'going', 'waitlist')", () => {
      expect(isAttendanceVerified("going")).toBe(false);
      expect(isAttendanceVerified("waitlist")).toBe(false);
      expect(isAttendanceVerified("cancelled")).toBe(false);
      expect(isAttendanceVerified("")).toBe(false);
    });
  });

  describe("Swag Expiration Formatting", () => {
    it("identifies valid future expiration dates", () => {
      const futureDate = "2026-12-25T12:00:00Z";
      const now = new Date("2026-08-12T00:00:00Z");

      const result = formatSwagExpiration(futureDate, now);
      expect(result.expired).toBe(false);
      expect(result.label).toContain("Expires on Dec 25, 2026");
    });

    it("identifies past expiration dates as expired", () => {
      const pastDate = "2026-01-01T00:00:00Z";
      const now = new Date("2026-08-12T00:00:00Z");

      const result = formatSwagExpiration(pastDate, now);
      expect(result.expired).toBe(true);
      expect(result.label).toBe("Expired");
    });

    it("handles null/missing expiration date", () => {
      const result = formatSwagExpiration(null);
      expect(result.expired).toBe(false);
      expect(result.label).toBe("No expiration date");
    });
  });
});
