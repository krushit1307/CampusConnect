import { describe, it, expect } from "vitest";
import {
  getCompanyLogoUrl,
  isJobPostingExpired,
  getDaysUntilExpiration,
  calculateRenewedExpirationDate,
} from "./alumniJobBoard";

describe("Alumni Job Board Utility (#2992)", () => {
  it("generates Clearbit company logo URL from domain", () => {
    expect(getCompanyLogoUrl("google.com")).toBe("https://logo.clearbit.com/google.com");
    expect(getCompanyLogoUrl("https://spotify.com/careers")).toBe("https://logo.clearbit.com/spotify.com");
    expect(getCompanyLogoUrl("microsoft")).toBe("https://logo.clearbit.com/microsoft.com");
  });

  it("identifies expired job postings older than 30 days", () => {
    const now = new Date("2026-08-14T00:00:00Z").getTime();
    const pastDate = new Date("2026-08-01T00:00:00Z").toISOString();
    const futureDate = new Date("2026-08-25T00:00:00Z").toISOString();

    expect(isJobPostingExpired(pastDate, now)).toBe(true);
    expect(isJobPostingExpired(futureDate, now)).toBe(false);
  });

  it("calculates remaining days until expiration accurately", () => {
    const now = new Date("2026-08-14T00:00:00Z").getTime();
    const expiry = new Date("2026-08-24T00:00:00Z").toISOString(); // 10 days away

    expect(getDaysUntilExpiration(expiry, now)).toBe(10);
  });

  it("renews job posting expiration by extending 30 days", () => {
    const currentExpiry = new Date("2026-08-20T00:00:00Z").toISOString();
    const renewedISO = calculateRenewedExpirationDate(currentExpiry);
    const renewedDate = new Date(renewedISO);

    expect(renewedDate.getDate()).toBe(19); // 30 days after Aug 20 is Sept 19
  });
});
