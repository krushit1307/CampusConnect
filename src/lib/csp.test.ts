import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Content Security Policy (CSP) Configuration", () => {
  it("vercel.json exists and configures strict Content-Security-Policy header", () => {
    const vercelJsonPath = path.resolve(process.cwd(), "vercel.json");
    expect(fs.existsSync(vercelJsonPath)).toBe(true);

    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
    const globalHeaderRule = vercelConfig.headers?.find(
      (h: { source: string }) => h.source === "/(.*)",
    );
    expect(globalHeaderRule).toBeDefined();

    const cspHeader = globalHeaderRule.headers?.find(
      (h: { key: string }) => h.key === "Content-Security-Policy",
    );
    expect(cspHeader).toBeDefined();
    expect(cspHeader.value).toContain("default-src 'self'");
    expect(cspHeader.value).toContain("script-src 'self'");
    expect(cspHeader.value).toContain("object-src 'none'");
    expect(cspHeader.value).toContain("frame-ancestors 'none'");
  });

  it("index.html contains valid Content-Security-Policy meta tag", () => {
    const indexPath = path.resolve(process.cwd(), "index.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");

    expect(htmlContent).toMatch(/http-equiv=["']Content-Security-Policy["']/i);
    expect(htmlContent).toContain("default-src 'self'");
    expect(htmlContent).toContain("object-src 'none'");
  });
});
