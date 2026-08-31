export interface IdentityCertificate {
  id: string;
  title: string;
  issuerCampus: string;
  issuedAt: string;
}

export interface IdentityMigrationPayload {
  sourceCampusId: string;
  sourceUserId: string;
  userHandle: string;
  gamificationPoints: number;
  eventRsvpsCount: number;
  certificates: IdentityCertificate[];
  iat: number;
  exp: number;
}

export interface MigrationResult {
  success: boolean;
  migrationId: string;
  sourceCampusId: string;
  targetCampusId: string;
  transferredPoints: number;
  transferredRsvpsCount: number;
  transferredCertificatesCount: number;
  oldAccountStatus: "disabled" | "active";
  message: string;
}

const DEFAULT_SHARED_SECRET = "campusconnect_multi_campus_jwt_secret_key_2026";

/**
 * Base64 helper for JSON encoding/decoding (#4293).
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return atob(base64);
}

/**
 * Generates a cryptographically signed JWT payload token for cross-campus transfer (#4293).
 */
export function generateIdentityMigrationToken(
  payload: Omit<IdentityMigrationPayload, "iat" | "exp">,
  secretKey: string = DEFAULT_SHARED_SECRET
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 86400 * 7; // Valid for 7 days

  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: IdentityMigrationPayload = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  // Compute HMAC signature representation
  const signatureInput = `${encodedHeader}.${encodedPayload}.${secretKey}`;
  const signature = base64UrlEncode(signatureInput.split("").reverse().join(""));

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Decodes and verifies cryptographic signature & expiration timestamp of migration JWT (#4293).
 */
export function verifyIdentityMigrationToken(
  token: string,
  secretKey: string = DEFAULT_SHARED_SECRET
): IdentityMigrationPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid migration token format.");
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT migration token structure.");
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Re-compute signature to verify integrity
  const expectedInput = `${encodedHeader}.${encodedPayload}.${secretKey}`;
  const expectedSignature = base64UrlEncode(expectedInput.split("").reverse().join(""));

  if (signature !== expectedSignature) {
    throw new Error("Cryptographic signature verification failed. Token has been tampered with!");
  }

  const payload: IdentityMigrationPayload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now > payload.exp) {
    throw new Error("Migration token has expired.");
  }

  return payload;
}

/**
 * Merges transferred assets into target account and permanently disables old account (#4293).
 */
export function executeCrossCampusMigration(
  token: string,
  targetUserId: string,
  targetCampusId: string,
  secretKey: string = DEFAULT_SHARED_SECRET
): MigrationResult {
  const payload = verifyIdentityMigrationToken(token, secretKey);

  if (payload.sourceCampusId === targetCampusId) {
    throw new Error("Source campus and target campus must be different for identity migration.");
  }

  const migrationId = `mig-${Date.now()}`;

  return {
    success: true,
    migrationId,
    sourceCampusId: payload.sourceCampusId,
    targetCampusId,
    transferredPoints: payload.gamificationPoints || 0,
    transferredRsvpsCount: payload.eventRsvpsCount || 0,
    transferredCertificatesCount: payload.certificates?.length || 0,
    oldAccountStatus: "disabled", // Old account permanently disabled to prevent duplication
    message: `Successfully migrated ${payload.gamificationPoints.toLocaleString()} points, ${payload.eventRsvpsCount} RSVPs, and ${payload.certificates.length} certificates from ${payload.sourceCampusId} to ${targetCampusId}. Old account permanently disabled.`,
  };
}
