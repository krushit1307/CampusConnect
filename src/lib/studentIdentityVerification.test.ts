import { describe, it, expect } from "vitest";
import {
  isStudentEduEmail,
  generateStudentVerificationOtp,
  validateOtpSubmission,
  resolveStudentVerificationState,
} from "./studentIdentityVerification";

describe("Implement Decentralized Identity Verification (Student Only) Suite (#3881)", () => {
  it("validates .edu email domains while rejecting generic Gmail/public domains", () => {
    expect(isStudentEduEmail("alex@stanford.edu")).toBe(true);
    expect(isStudentEduEmail("student@mit.edu")).toBe(true);
    expect(isStudentEduEmail("user@gmail.com")).toBe(false);
    expect(isStudentEduEmail("attacker@yahoo.com")).toBe(false);
  });

  it("generates a 6-digit numerical OTP with a 10-minute expiry window", () => {
    const otp = generateStudentVerificationOtp("alex@stanford.edu");

    expect(otp.otpCode).toMatch(/^\d{6}$/);
    expect(otp.email).toBe("alex@stanford.edu");
    expect(new Date(otp.expiresAtIso).getTime()).toBeGreaterThan(Date.now());
  });

  it("validates matching OTP code and catches expired codes", () => {
    const futureExpiry = new Date(Date.now() + 600000).toISOString();
    const pastExpiry = new Date(Date.now() - 600000).toISOString();

    expect(validateOtpSubmission("123456", "123456", futureExpiry).isValid).toBe(true);
    expect(validateOtpSubmission("123456", "000000", futureExpiry).isValid).toBe(false);
    expect(validateOtpSubmission("123456", "123456", pastExpiry).isValid).toBe(false);
  });

  it("resolves verification routing states for non-edu, pending, and verified students", () => {
    const invalidDomain = resolveStudentVerificationState("user@gmail.com", false);
    expect(invalidDomain.status).toBe("INVALID_DOMAIN");
    expect(invalidDomain.isEduEmail).toBe(false);

    const pending = resolveStudentVerificationState("student@university.edu", false);
    expect(pending.status).toBe("PENDING_OTP");
    expect(pending.isVerified).toBe(false);

    const verified = resolveStudentVerificationState("student@university.edu", true);
    expect(verified.status).toBe("VERIFIED");
    expect(verified.isVerified).toBe(true);
  });
});
