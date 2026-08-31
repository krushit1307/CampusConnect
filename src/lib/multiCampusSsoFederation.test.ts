import { describe, it, expect } from "vitest";
import {
  extractDomainFromEmail,
  validateSamlAssertion,
  consumeSamlAssertionAndProvisionUser,
  SamlAssertionPayload,
} from "./multiCampusSsoFederation";

describe("Develop Dynamic Multi-Campus Single Sign-On Federation Suite (#4783)", () => {
  const validAssertion: SamlAssertionPayload = {
    issuerEntityId: "https://idp.harvard.edu/shibboleth",
    subjectId: "harvard_student_9901",
    email: "student@harvard.edu",
    fullName: "Elena Rostova",
    homeInstitutionDomain: "harvard.edu",
    signatureIsValid: true,
    assertionNotOnOrAfterIso: "2026-08-27T15:00:00Z",
  };

  it("extracts institutional domain from student email for IdP routing", () => {
    expect(extractDomainFromEmail("student@harvard.edu")).toBe("harvard.edu");
    expect(extractDomainFromEmail("alex@mit.edu")).toBe("mit.edu");
    expect(() => extractDomainFromEmail("invalid-email")).toThrow("Invalid email format");
  });

  it("validates signature and expiration timestamp of SAML 2.0 assertions", () => {
    const validResult = validateSamlAssertion(validAssertion, "2026-08-27T14:00:00Z");
    expect(validResult.isValid).toBe(true);

    const expiredResult = validateSamlAssertion(validAssertion, "2026-08-27T16:00:00Z");
    expect(expiredResult.isValid).toBe(false);
    expect(expiredResult.error).toBe("SAML assertion has expired.");

    const invalidSigResult = validateSamlAssertion(
      { ...validAssertion, signatureIsValid: false },
      "2026-08-27T14:00:00Z",
    );
    expect(invalidSigResult.isValid).toBe(false);
    expect(invalidSigResult.error).toContain("Invalid cryptographic SAML signature");
  });

  it("provisions JIT Federated User account without password or email verification loop", () => {
    const provisioned = consumeSamlAssertionAndProvisionUser(validAssertion);

    expect(provisioned.email).toBe("student@harvard.edu");
    expect(provisioned.homeInstitutionDomain).toBe("harvard.edu");
    expect(provisioned.isEmailVerified).toBe(true);
    expect(provisioned.requiresPasswordSetup).toBe(false);
    expect(provisioned.isNewlyProvisioned).toBe(true);
  });
});
