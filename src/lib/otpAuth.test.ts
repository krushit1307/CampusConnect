import { describe, it, expect } from "vitest";
import { cleanOtpInput, validateOtpCode, sendOtpEmail, verifyOtpCode } from "./otpAuth";

describe("Passwordless OTP Authentication Helpers (#2648)", () => {
  it("cleans and sanitizes typed or pasted OTP inputs", () => {
    expect(cleanOtpInput("123456")).toBe("123456");
    expect(cleanOtpInput("  123-456  ")).toBe("123456");
    expect(cleanOtpInput("abc123def456789")).toBe("123456");
    expect(cleanOtpInput("")).toBe("");
  });

  it("validates 6-digit numeric OTP code format", () => {
    expect(validateOtpCode("123456")).toBe(true);
    expect(validateOtpCode("000000")).toBe(true);
    expect(validateOtpCode("12345")).toBe(false);
    expect(validateOtpCode("1234567")).toBe(false);
    expect(validateOtpCode("abcdef")).toBe(false);
  });

  it("sendOtpEmail returns error for invalid email", async () => {
    const resEmpty = await sendOtpEmail("");
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.error).toBe("Please enter a valid email address.");

    const resInvalid = await sendOtpEmail("invalid-email");
    expect(resInvalid.success).toBe(false);
  });

  it("verifyOtpCode returns error for invalid code length", async () => {
    const resShort = await verifyOtpCode("test@campus.edu", "123");
    expect(resShort.success).toBe(false);
    expect(resShort.error).toBe("OTP code must be a 6-digit numeric code.");
  });
});
