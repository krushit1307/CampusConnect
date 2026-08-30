import { describe, it, expect } from "vitest";
import {
  parseStoredConsentCookie,
  serializeConsentCookie,
  evaluateAndExecuteTrackingScripts,
  CONSENT_COOKIE_NAME,
  CURRENT_CONSENT_VERSION,
} from "./granularCookieConsent";

describe("Implement Automated Data Privacy Granular Cookie Consent Suite (#4790)", () => {
  it("serializes and parses consent cookies with version validation", () => {
    const cookieStr = serializeConsentCookie(true, false);
    expect(cookieStr).toContain(CONSENT_COOKIE_NAME);
    expect(cookieStr).toContain("Max-Age=31536000");

    const parsed = parseStoredConsentCookie(cookieStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.essential).toBe(true);
    expect(parsed?.analytics).toBe(true);
    expect(parsed?.marketing).toBe(false);
    expect(parsed?.version).toBe(CURRENT_CONSENT_VERSION);
  });

  it("loads analytics scripts only when analytics consent is granted", () => {
    const analyticsGranted = evaluateAndExecuteTrackingScripts({
      essential: true,
      analytics: true,
      marketing: false,
      version: CURRENT_CONSENT_VERSION,
    });

    expect(analyticsGranted.googleAnalyticsLoaded).toBe(true);
    expect(analyticsGranted.mixpanelLoaded).toBe(true);
    expect(analyticsGranted.metaPixelLoaded).toBe(false);
    expect(analyticsGranted.purgedCookies).toContain("_fbp");
  });

  it("halts all third-party tracking scripts and purges storage when consent is rejected", () => {
    const allRejected = evaluateAndExecuteTrackingScripts({
      essential: true,
      analytics: false,
      marketing: false,
      version: CURRENT_CONSENT_VERSION,
    });

    expect(allRejected.googleAnalyticsLoaded).toBe(false);
    expect(allRejected.mixpanelLoaded).toBe(false);
    expect(allRejected.metaPixelLoaded).toBe(false);
    expect(allRejected.purgedCookies).toContain("_ga");
    expect(allRejected.purgedCookies).toContain("mp_*_mixpanel");
    expect(allRejected.purgedCookies).toContain("_fbp");
  });
});
