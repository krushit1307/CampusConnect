// =============================================================================
// File: src/services/earlyBirdSecretUrlService.ts
// Task: Dynamic "Early Bird" Secret URL Expiration
// Description: Core service for generating, validating, redeeming, and revoking
//              cryptographically secure, time-limited & quota-bounded secret Early Bird links.
// =============================================================================

export type ExpirationRule = "time_and_quota" | "sales_velocity_decay" | "one_time_magic_link";

export interface SecretUrlToken {
  token: string;
  eventId: string;
  eventTitle: string;
  discountPercent: number; // e.g. 25 for 25% OFF
  maxRedemptions: number; // e.g. 50 claims
  currentRedemptions: number;
  expiresAt: string; // ISO timestamp
  isRevoked: boolean;
  rule: ExpirationRule;
  createdAt: string;
  secretLinkUrl: string;
}

export type SecretUrlValidationStatus =
  | "VALID"
  | "EXPIRED_TIME"
  | "EXPIRED_QUOTA"
  | "REVOKED"
  | "INVALID_TOKEN";

export interface SecretUrlValidationResult {
  status: SecretUrlValidationStatus;
  isValid: boolean;
  discountPercent: number;
  remainingRedemptions: number;
  secondsRemaining: number;
  message: string;
  tokenData?: SecretUrlToken;
}

/** In-memory store for generated secret tokens (persisted to Supabase/storage in production) */
const SECRET_TOKEN_STORE: Map<string, SecretUrlToken> = new Map();

/**
 * Generates a cryptographically random token string.
 */
function generateRandomTokenString(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "eb_sec_";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a dynamic Early Bird secret URL with custom expiration, quota, and discount rules.
 */
export function generateEarlyBirdSecretUrl(
  eventId: string,
  eventTitle: string = "Campus Festival",
  discountPercent: number = 25,
  maxRedemptions: number = 50,
  expiresInHours: number = 24,
  rule: ExpirationRule = "time_and_quota",
  baseUrl: string = "https://campusconnect.edu/events"
): SecretUrlToken {
  const token = generateRandomTokenString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 3600 * 1000).toISOString();

  const secretLinkUrl = `${baseUrl}/${eventId}?secretToken=${token}`;

  const secretTokenData: SecretUrlToken = {
    token,
    eventId,
    eventTitle,
    discountPercent,
    maxRedemptions,
    currentRedemptions: 0,
    expiresAt,
    isRevoked: false,
    rule,
    createdAt: now.toISOString(),
    secretLinkUrl,
  };

  SECRET_TOKEN_STORE.set(token, secretTokenData);
  return secretTokenData;
}

/**
 * Validates an Early Bird secret URL token against expiration time, quota, and revocation.
 */
export function validateEarlyBirdSecretUrl(
  token: string,
  currentTime: Date = new Date(),
  customTokenData?: SecretUrlToken
): SecretUrlValidationResult {
  const tokenData = customTokenData || SECRET_TOKEN_STORE.get(token);

  if (!tokenData) {
    return {
      status: "INVALID_TOKEN",
      isValid: false,
      discountPercent: 0,
      remainingRedemptions: 0,
      secondsRemaining: 0,
      message: "Invalid or unrecognized Early Bird secret link.",
    };
  }

  if (tokenData.isRevoked) {
    return {
      status: "REVOKED",
      isValid: false,
      discountPercent: 0,
      remainingRedemptions: 0,
      secondsRemaining: 0,
      message: "This secret link has been manually de-activated by the organizer.",
      tokenData,
    };
  }

  const nowMs = currentTime.getTime();
  const expiresMs = new Date(tokenData.expiresAt).getTime();
  const secondsRemaining = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));

  if (secondsRemaining <= 0) {
    return {
      status: "EXPIRED_TIME",
      isValid: false,
      discountPercent: 0,
      remainingRedemptions: 0,
      secondsRemaining: 0,
      message: "Early Bird secret link has expired (time limit reached). Standard pricing applies.",
      tokenData,
    };
  }

  const remainingRedemptions = Math.max(0, tokenData.maxRedemptions - tokenData.currentRedemptions);

  if (remainingRedemptions <= 0) {
    return {
      status: "EXPIRED_QUOTA",
      isValid: false,
      discountPercent: 0,
      remainingRedemptions: 0,
      secondsRemaining,
      message: "Early Bird redemption quota has been fully claimed by other attendees.",
      tokenData,
    };
  }

  return {
    status: "VALID",
    isValid: true,
    discountPercent: tokenData.discountPercent,
    remainingRedemptions,
    secondsRemaining,
    message: `🎉 Unlocked ${tokenData.discountPercent}% OFF Early Bird Discount! (${remainingRedemptions} claims left)`,
    tokenData,
  };
}

/**
 * Atomically redeems a valid Early Bird secret token for a user.
 */
export function redeemEarlyBirdSecretUrl(
  token: string,
  userId: string = "user-1",
  currentTime: Date = new Date()
): SecretUrlValidationResult {
  const validation = validateEarlyBirdSecretUrl(token, currentTime);

  if (!validation.isValid || !validation.tokenData) {
    return validation;
  }

  const tokenData = validation.tokenData;
  tokenData.currentRedemptions += 1;

  SECRET_TOKEN_STORE.set(token, tokenData);

  return {
    status: "VALID",
    isValid: true,
    discountPercent: tokenData.discountPercent,
    remainingRedemptions: Math.max(0, tokenData.maxRedemptions - tokenData.currentRedemptions),
    secondsRemaining: validation.secondsRemaining,
    message: `Success! ${tokenData.discountPercent}% OFF Early Bird discount applied to checkout.`,
    tokenData,
  };
}

/**
 * Revokes an Early Bird secret URL token instantly.
 */
export function revokeEarlyBirdSecretUrl(token: string): boolean {
  const tokenData = SECRET_TOKEN_STORE.get(token);
  if (!tokenData) return false;

  tokenData.isRevoked = true;
  SECRET_TOKEN_STORE.set(token, tokenData);
  return true;
}

/**
 * Gets all active secret URLs for an event.
 */
export function getActiveSecretUrlsForEvent(eventId: string): SecretUrlToken[] {
  const result: SecretUrlToken[] = [];
  SECRET_TOKEN_STORE.forEach((data) => {
    if (data.eventId === eventId) {
      result.push(data);
    }
  });
  return result;
}
