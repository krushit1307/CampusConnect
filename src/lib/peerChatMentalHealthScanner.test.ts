import { describe, it, expect } from "vitest";
import {
  scanChatMessageLocal,
  getSupportResourceMeta,
} from "./peerChatMentalHealthScanner";

describe("Privacy-Preserving Peer Chat Mental Health Scanner Utility (#4503)", () => {
  it("detects high-stress academic keywords and returns subtle support text", () => {
    const message = "I am so stressed about finals I want to drop out";
    const result = scanChatMessageLocal(message);

    expect(result.isTriggered).toBe(true);
    expect(result.category).toBe("academic_stress");
    expect(result.detectedKeywords).toContain("stressed");
    expect(result.detectedKeywords).toContain("drop out");
    expect(result.supportBannerText).toContain("Finals got you stressed? The Campus Counseling Center has free walk-in hours today.");
    expect(result.privacyGuardVerified).toBe(true);
  });

  it("does NOT trigger for standard chat messages", () => {
    const cleanMessage = "Hey everyone! Are we meeting at the library at 5 PM for the project review?";
    const result = scanChatMessageLocal(cleanMessage);

    expect(result.isTriggered).toBe(false);
    expect(result.category).toBe("none");
    expect(result.privacyGuardVerified).toBe(true);
  });

  it("verifies 100% local client-side privacy guard execution", () => {
    const result = scanChatMessageLocal("feeling overwhelmed with coursework");
    expect(result.privacyGuardVerified).toBe(true);
    expect(result.category).toBe("academic_stress");
  });

  it("returns correct support resource metadata", () => {
    const meta = getSupportResourceMeta("academic_stress");
    expect(meta.title).toBe("Campus Counseling Center");
    expect(meta.url).toBe("/wellness/counseling-walk-in");
  });
});
