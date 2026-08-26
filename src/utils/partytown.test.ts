import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Partytown Integration Test (#2435)", () => {
  it("verifies index.html has GTM, Facebook Pixel, and Hotjar scripts with text/partytown type", () => {
    const indexPath = path.resolve(__dirname, "../../../index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf8");

    // Check script types are correctly set to text/partytown
    expect(htmlContent).toContain('type="text/partytown"');

    // Verify GTM is included
    expect(htmlContent).toContain("googletagmanager.com/gtm.js");

    // Verify Facebook Pixel is included
    expect(htmlContent).toContain("connect.facebook.net/en_US/fbevents.js");

    // Verify Hotjar is included
    expect(htmlContent).toContain("static.hotjar.com/c/hotjar-");
  });

  it("verifies CSP headers in config files allow GTM, Facebook, and Hotjar domains", () => {
    const vercelPath = path.resolve(__dirname, "../../../vercel.json");
    const vercelContent = fs.readFileSync(vercelPath, "utf8");

    expect(vercelContent).toContain("https://www.google-analytics.com");
    expect(vercelContent).toContain("https://www.googletagmanager.com");
    expect(vercelContent).toContain("https://connect.facebook.net");
    expect(vercelContent).toContain("https://*.hotjar.com");
    expect(vercelContent).toContain("worker-src 'self' blob:");
  });
});
