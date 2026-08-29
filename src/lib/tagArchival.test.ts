import { describe, expect, it } from "vitest";
import { isActiveTagStatus, isTagEligibleForArchive } from "./tagArchival";

describe("tag archival policy", () => {
  const now = new Date("2027-09-10T12:00:00.000Z");

  it("archives tags older than twelve months", () => {
    expect(isTagEligibleForArchive("2026-09-09T12:00:00.000Z", now)).toBe(true);
    expect(isTagEligibleForArchive("2026-09-10T12:00:00.000Z", now)).toBe(false);
    expect(isTagEligibleForArchive("2027-01-01T00:00:00.000Z", now)).toBe(false);
  });

  it("does not archive invalid timestamps", () => {
    expect(isTagEligibleForArchive("not-a-date", now)).toBe(false);
  });

  it("keeps only active tags in active taxonomy consumers", () => {
    expect(isActiveTagStatus("active")).toBe(true);
    expect(isActiveTagStatus("archived")).toBe(false);
    expect(isActiveTagStatus(null)).toBe(false);
  });
});
