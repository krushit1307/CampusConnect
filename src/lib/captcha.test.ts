import { describe, expect, it } from "vitest";
import { isCaptchaConfigured, shouldRequireCaptcha } from "./captcha";

describe("captcha helpers", () => {
  it("does not require CAPTCHA when the provider is not configured", () => {
    expect(isCaptchaConfigured(undefined, undefined)).toBe(false);
    expect(shouldRequireCaptcha(undefined, undefined, undefined)).toBe(false);
  });

  it("requires a token when the provider is configured", () => {
    expect(isCaptchaConfigured("site-key", "secret-key")).toBe(true);
    expect(shouldRequireCaptcha("site-key", "secret-key", "token")).toBe(true);
    expect(shouldRequireCaptcha("site-key", "secret-key", undefined)).toBe(false);
  });
});
