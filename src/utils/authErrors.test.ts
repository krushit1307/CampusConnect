import { describe, it, expect } from "vitest";
import { getFriendlyAuthError } from "./authErrors";

describe("getFriendlyAuthError", () => {
  it("returns default message for null or empty error object", () => {
    // @ts-expect-error testing invalid inputs
    expect(getFriendlyAuthError(null)).toBe(
      "An unexpected authentication error occurred. Please try again.",
    );
    // @ts-expect-error testing invalid inputs
    expect(getFriendlyAuthError({})).toBe(
      "An unexpected authentication error occurred. Please try again.",
    );
    expect(getFriendlyAuthError(new Error(""))).toBe(
      "An unexpected authentication error occurred. Please try again.",
    );
  });

  it("handles 'Invalid login credentials' error", () => {
    const err = new Error("Invalid login credentials");
    expect(getFriendlyAuthError(err)).toBe("Invalid email or password. Please try again.");
  });

  it("handles 'User already registered' and 'email already in use' errors", () => {
    const err1 = new Error("User already registered");
    const err2 = new Error("Email already in use");
    expect(getFriendlyAuthError(err1)).toBe("An account with this email address already exists.");
    expect(getFriendlyAuthError(err2)).toBe("An account with this email address already exists.");
  });

  it("handles weak/invalid password errors during signup", () => {
    const err1 = new Error("Signup requires a valid password");
    const err2 = new Error("Password is too short");
    const err3 = new Error("Weak password");
    expect(getFriendlyAuthError(err1)).toBe(
      "Password does not meet the requirements. Please use a stronger password.",
    );
    expect(getFriendlyAuthError(err2)).toBe(
      "Password does not meet the requirements. Please use a stronger password.",
    );
    expect(getFriendlyAuthError(err3)).toBe(
      "Password does not meet the requirements. Please use a stronger password.",
    );
  });

  it("handles email not confirmed errors", () => {
    const err1 = new Error("Email not confirmed");
    const err2 = new Error("Email confirmation required");
    expect(getFriendlyAuthError(err1)).toBe(
      "Please confirm your email address before signing in. Check your inbox for a verification link.",
    );
    expect(getFriendlyAuthError(err2)).toBe(
      "Please confirm your email address before signing in. Check your inbox for a verification link.",
    );
  });

  it("handles auth session errors", () => {
    const err1 = new Error("Auth session missing");
    const err2 = new Error("session_not_found");
    expect(getFriendlyAuthError(err1)).toBe("Your session has expired. Please sign in again.");
    expect(getFriendlyAuthError(err2)).toBe("Your session has expired. Please sign in again.");
  });

  it("handles rate limiting errors", () => {
    const err1 = new Error("rate limit exceeded");
    const err2 = new Error("too many requests");
    const err3 = new Error("email rate limit exceeded");
    expect(getFriendlyAuthError(err1)).toBe("Too many attempts. Please try again later.");
    expect(getFriendlyAuthError(err2)).toBe("Too many attempts. Please try again later.");
    expect(getFriendlyAuthError(err3)).toBe("Too many attempts. Please try again later.");
  });

  it("handles invalid email format errors", () => {
    const err1 = new Error("invalid email");
    const err2 = new Error("email address is invalid");
    expect(getFriendlyAuthError(err1)).toBe("Please enter a valid email address.");
    expect(getFriendlyAuthError(err2)).toBe("Please enter a valid email address.");
  });

  it("handles network connectivity errors", () => {
    const err1 = new Error("network error");
    const err2 = new Error("failed to fetch");
    expect(getFriendlyAuthError(err1)).toBe(
      "Network error. Please check your connection and try again.",
    );
    expect(getFriendlyAuthError(err2)).toBe(
      "Network error. Please check your connection and try again.",
    );
  });

  it("returns original message for unmapped errors", () => {
    const customMessage = "Something specific and rare happened with database constraint";
    const err = new Error(customMessage);
    expect(getFriendlyAuthError(err)).toBe(customMessage);
  });
});
