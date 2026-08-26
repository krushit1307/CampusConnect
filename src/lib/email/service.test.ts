import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendVerificationEmail } from "./service";
import { getVerificationEmailHtml, getVerificationEmailText } from "./templates";

describe("Email Verification Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Templates", () => {
    it("generates HTML template with recipient name and verification URL", () => {
      const html = getVerificationEmailHtml({
        recipientName: "Ada Lovelace",
        verificationUrl: "https://campusconnect.edu/verify-email?token=123",
      });

      expect(html).toContain("Ada Lovelace");
      expect(html).toContain("https://campusconnect.edu/verify-email?token=123");
      expect(html).toContain("CAMPUS");
      expect(html).toContain("CONNECT");
    });

    it("generates plain text template with recipient name and verification URL", () => {
      const text = getVerificationEmailText({
        recipientName: "Grace Hopper",
        verificationUrl: "https://campusconnect.edu/verify-email?token=abc",
      });

      expect(text).toContain("Hey Grace Hopper");
      expect(text).toContain("https://campusconnect.edu/verify-email?token=abc");
    });
  });

  describe("Service Dispatch", () => {
    it("sends email via mock provider when no API key is set", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await sendVerificationEmail({
        to: "student@college.edu",
        recipientName: "Test Student",
        verificationUrl: "http://localhost:5173/verify-email?token=test_token",
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("mock");
      expect(result.messageId).toContain("mock_");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
