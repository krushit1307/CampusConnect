import { describe, it, expect } from "vitest";
import { generateCspNonce, buildStrictCspHeader, parseCspViolationReport } from "./cspSecurity";

describe("Strict CSP & Nonce Security Suite (#2799)", () => {
  it("generates unique cryptographically secure nonces", () => {
    const nonce1 = generateCspNonce();
    const nonce2 = generateCspNonce();

    expect(nonce1).toBeDefined();
    expect(nonce1.length).toBeGreaterThan(10);
    expect(nonce1).not.toBe(nonce2);
  });

  it("builds strict CSP header with injected nonce and whitelisted origins", () => {
    const nonce = "testNonce12345";
    const header = buildStrictCspHeader({
      nonce,
      reportUri: "/api/csp-report",
      isDevelopment: false,
    });

    expect(header).toContain(`script-src 'self' 'nonce-testNonce12345' https://js.stripe.com`);
    expect(header).toContain("object-src 'none'");
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).toContain(
      "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co",
    );
    expect(header).toContain("report-uri /api/csp-report");
  });

  it("parses incoming browser CSP violation report logs accurately", () => {
    const rawReport = {
      "csp-report": {
        "document-uri": "https://campusconnect.edu/feed",
        "blocked-uri": "https://malicious-xss.com/payload.js",
        "violated-directive": "script-src",
        "original-policy": "default-src 'self'",
      },
    };

    const parsed = parseCspViolationReport(rawReport);

    expect(parsed).not.toBeNull();
    expect(parsed?.blockedUri).toBe("https://malicious-xss.com/payload.js");
    expect(parsed?.violatedDirective).toBe("script-src");
  });
});
