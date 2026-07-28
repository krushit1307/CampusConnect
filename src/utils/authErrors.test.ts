import { describe, it, expect } from "vitest";
import { getFriendlyAuthError } from "./authErrors";

describe("getFriendlyAuthError", () => {
  it("returns default message for null or undefined error", () => {
    expect(getFriendlyAuthError(null)).toBe("An unknown authentication error occurred.");
    expect(getFriendlyAuthError(undefined)).toBe("An unknown authentication error occurred.");
  });

  it("handles status 429 error objects", () => {
    const errorObj = { status: 429, message: "Too many requests" };
    expect(getFriendlyAuthError(errorObj)).toBe("Account locked, try again in 15 minutes");
  });

  it("maps invalid login credentials", () => {
    expect(getFriendlyAuthError("Invalid login credentials")).toBe(
      "The email or password you entered is incorrect.",
    );
  });

  it("maps user already registered", () => {
    expect(getFriendlyAuthError("User already registered")).toBe(
      "An account with this email address already exists.",
    );
  });

  it("maps rate limit message when status is not 429 but message matches", () => {
    expect(getFriendlyAuthError("Rate limit exceeded")).toBe(
      "Too many requests. Please try again in a few minutes.",
    );
  });

  it("maps weak password", () => {
    expect(getFriendlyAuthError("Password is too weak")).toBe("Please choose a stronger password.");
  });

  it("maps same password", () => {
    expect(getFriendlyAuthError("New password should be different")).toBe(
      "Your new password must be different from your current password.",
    );
  });

  it("maps expired reset token", () => {
    expect(getFriendlyAuthError("Token has expired")).toBe(
      "This reset link has expired. Please request a new password reset email.",
    );
  });

  it("maps invalid reset token", () => {
    expect(getFriendlyAuthError("Invalid token")).toBe(
      "This password reset link is invalid. Please request a new one.",
    );
  });
});
