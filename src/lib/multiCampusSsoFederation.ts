export interface IdentityProviderConfig {
  id: string;
  domain: string;
  institutionName: string;
  entityId: string;
  ssoRedirectUrl: string;
  x509PublicCert: string;
}

export interface SamlAssertionPayload {
  issuerEntityId: string;
  subjectId: string;
  email: string;
  fullName: string;
  homeInstitutionDomain: string;
  signatureIsValid: boolean;
  assertionNotOnOrAfterIso: string;
}

export interface ProvisionedFederatedUser {
  userId: string;
  email: string;
  fullName: string;
  homeInstitutionDomain: string;
  isEmailVerified: boolean;
  requiresPasswordSetup: boolean;
  isNewlyProvisioned: boolean;
}

/**
 * Extracts the email domain to route user login to their native university IdP.
 */
export function extractDomainFromEmail(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) {
    throw new Error("Invalid email format for SSO domain resolution.");
  }
  return parts[1];
}

/**
 * Validates incoming SAML 2.0 / Shibboleth assertion parameters and signature status.
 */
export function validateSamlAssertion(
  assertion: SamlAssertionPayload,
  nowIso: string = new Date().toISOString(),
): { isValid: boolean; error?: string } {
  if (!assertion.signatureIsValid) {
    return {
      isValid: false,
      error: "Invalid cryptographic SAML signature from Identity Provider.",
    };
  }

  const expiryTime = new Date(assertion.assertionNotOnOrAfterIso).getTime();
  const currentTime = new Date(nowIso).getTime();

  if (currentTime >= expiryTime) {
    return { isValid: false, error: "SAML assertion has expired." };
  }

  if (!assertion.email || !assertion.subjectId) {
    return {
      isValid: false,
      error: "Missing required claims (email or subject ID) in assertion payload.",
    };
  }

  return { isValid: true };
}

/**
 * Consumes validated SAML assertion to construct Just-In-Time (JIT) Federated User profile payload.
 */
export function consumeSamlAssertionAndProvisionUser(
  assertion: SamlAssertionPayload,
  existingUserId?: string | null,
): ProvisionedFederatedUser {
  const validation = validateSamlAssertion(assertion);
  if (!validation.isValid) {
    throw new Error(validation.error || "SAML assertion validation failed.");
  }

  const userId = existingUserId || `usr_fed_${Math.random().toString(36).substring(2, 9)}`;

  return {
    userId,
    email: assertion.email.toLowerCase(),
    fullName: assertion.fullName,
    homeInstitutionDomain: assertion.homeInstitutionDomain.toLowerCase(),
    isEmailVerified: true, // Pre-verified via SAML 2.0 assertion
    requiresPasswordSetup: false, // Passwordless federated login
    isNewlyProvisioned: !existingUserId,
  };
}
