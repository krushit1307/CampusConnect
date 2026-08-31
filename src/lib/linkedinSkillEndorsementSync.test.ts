import { describe, expect, it } from "vitest";
import {
  buildCertificationPayload,
  buildLinkedInAuthorizationUrl,
  buildVerificationUrl,
  isRetryableLinkedInStatus,
  normalizeSkillName,
} from "./linkedinSkillEndorsementSync";

describe("linkedin skill endorsement sync helpers", () => {
  const certificate = {
    id: "cert-123",
    series_name: "React Bootcamp",
    user_name: "Student Example",
    completion_date: "2026-08-27",
    verification_hash: "hash/with spaces",
  };

  it("normalizes skill names without allowing unbounded whitespace or length", () => {
    expect(normalizeSkillName("  React  .js  ")).toBe("React .js");
    expect(normalizeSkillName("x".repeat(200))).toHaveLength(120);
  });

  it("builds an authorization URL with encoded CSRF state and least-privilege scopes", () => {
    const url = buildLinkedInAuthorizationUrl(
      "https://www.linkedin.com/oauth/v2/authorization",
      "client-id",
      "https://example.com/functions/v1/linkedin-skill-sync",
      "state/value",
    );
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe("client-id");
    expect(params.get("state")).toBe("state/value");
    expect(params.get("scope")).toBe("openid profile w_member_social");
  });

  it("creates a verifiable certification payload", () => {
    const verificationUrl = buildVerificationUrl(
      "https://campusconnect.app/",
      certificate.verification_hash,
    );
    const payload = buildCertificationPayload(certificate, "React.js", verificationUrl);
    expect(payload.name.localized.en_US).toBe("React.js — React Bootcamp");
    expect(payload.licenseNumber.localized.en_US).toBe("CampusConnect-cert-123");
    expect(payload.startMonthYear).toEqual({ month: 8, year: 2026 });
    expect(payload.url).toContain("hash%2Fwith%20spaces");
  });

  it("classifies transient LinkedIn responses for retry", () => {
    expect(isRetryableLinkedInStatus(429)).toBe(true);
    expect(isRetryableLinkedInStatus(503)).toBe(true);
    expect(isRetryableLinkedInStatus(400)).toBe(false);
  });
});
