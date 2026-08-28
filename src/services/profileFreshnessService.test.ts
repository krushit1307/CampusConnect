import { describe, it, expect } from "vitest";
import { isProfileDataStale, getStaleProfilePromptText } from "./profileFreshnessService";

describe("profileFreshnessService", () => {
  it("detects missing date as stale", () => {
    expect(isProfileDataStale(null)).toBe(true);
    expect(isProfileDataStale(undefined)).toBe(true);
  });

  it("detects timestamps older than 1 year as stale", () => {
    const fourteenMonthsAgo = new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isProfileDataStale(fourteenMonthsAgo)).toBe(true);
  });

  it("detects timestamps newer than 1 year as fresh", () => {
    const twoMonthsAgo = new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isProfileDataStale(twoMonthsAgo)).toBe(false);
  });

  it("formats prompt text with specific major", () => {
    const prompt = getStaleProfilePromptText("Biology");
    expect(prompt).toContain("Are you still a Biology Major?");
    expect(prompt).toContain("Help us give you better recommendations");
  });

  it("formats generic prompt text when major is not provided", () => {
    const prompt = getStaleProfilePromptText(null);
    expect(prompt).toContain("It has been over a year since you last updated your profile.");
  });
});
