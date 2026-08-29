import { describe, it, expect } from "vitest";
import {
  generateEarlyBirdSecretUrl,
  validateEarlyBirdSecretUrl,
  redeemEarlyBirdSecretUrl,
  revokeEarlyBirdSecretUrl,
} from "../earlyBirdSecretUrlService";

describe("Early Bird Secret URL Expiration Service", () => {
  describe("generateEarlyBirdSecretUrl", () => {
    it("generates a signed secret URL token with 25% discount and 24h expiration", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 25, 50, 24);

      expect(secret.token).toBeDefined();
      expect(secret.token.startsWith("eb_sec_")).toBe(true);
      expect(secret.discountPercent).toBe(25);
      expect(secret.maxRedemptions).toBe(50);
      expect(secret.currentRedemptions).toBe(0);
      expect(secret.isRevoked).toBe(false);
      expect(secret.secretLinkUrl).toContain("secretToken=");
    });
  });

  describe("validateEarlyBirdSecretUrl", () => {
    it("returns VALID status for active secret token before expiration", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 20, 10, 24);
      const validation = validateEarlyBirdSecretUrl(secret.token);

      expect(validation.status).toBe("VALID");
      expect(validation.isValid).toBe(true);
      expect(validation.discountPercent).toBe(20);
      expect(validation.remainingRedemptions).toBe(10);
    });

    it("returns EXPIRED_TIME status when current time exceeds expiresAt", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 20, 10, 2);
      const expiredTime = new Date(Date.now() + 3 * 3600 * 1000); // 3 hours in future (> 2h limit)

      const validation = validateEarlyBirdSecretUrl(secret.token, expiredTime);
      expect(validation.status).toBe("EXPIRED_TIME");
      expect(validation.isValid).toBe(false);
    });

    it("returns EXPIRED_QUOTA status when redemptions reach maxRedemptions", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 30, 1, 24);
      secret.currentRedemptions = 1; // max reached

      const validation = validateEarlyBirdSecretUrl(secret.token, new Date(), secret);
      expect(validation.status).toBe("EXPIRED_QUOTA");
      expect(validation.isValid).toBe(false);
    });

    it("returns REVOKED status when token is revoked", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 30, 10, 24);
      revokeEarlyBirdSecretUrl(secret.token);

      const validation = validateEarlyBirdSecretUrl(secret.token);
      expect(validation.status).toBe("REVOKED");
      expect(validation.isValid).toBe(false);
    });
  });

  describe("redeemEarlyBirdSecretUrl", () => {
    it("atomically increments currentRedemptions on successful claim", () => {
      const secret = generateEarlyBirdSecretUrl("evt-gala", "Spring Gala", 25, 5, 24);

      const res = redeemEarlyBirdSecretUrl(secret.token, "user-100");
      expect(res.isValid).toBe(true);
      expect(res.remainingRedemptions).toBe(4);
    });
  });
});
