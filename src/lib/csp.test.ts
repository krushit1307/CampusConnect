import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Content Security Policy (CSP) Configuration (#1561)", () => {
  const vercelJsonPath = path.resolve(process.cwd(), "vercel.json");
  const indexPath = path.resolve(process.cwd(), "index.html");
  const viteConfigPath = path.resolve(process.cwd(), "vite.config.ts");
  const publicHeadersPath = path.resolve(process.cwd(), "public/_headers");
  const publicServeJsonPath = path.resolve(process.cwd(), "public/serve.json");

  it("vercel.json configures strict Content-Security-Policy header without unsafe-inline in script-src", () => {
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

    const cspValue = cspHeader.value;
    expect(cspValue).toContain("default-src 'self'");
    expect(cspValue).toContain("script-src 'self'");
    expect(cspValue).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(cspValue).not.toContain("'unsafe-eval'");
    expect(cspValue).toContain("object-src 'none'");
    expect(cspValue).toContain("frame-ancestors 'none'");
    expect(cspValue).toContain("https://*.supabase.co");
    expect(cspValue).toContain("https://s3.amazonaws.com");
    expect(cspValue).toContain("https://images.unsplash.com");
  });

  it("index.html contains strict Content-Security-Policy meta tag without unsafe-inline in script-src", () => {
    const htmlContent = fs.readFileSync(indexPath, "utf-8");

    expect(htmlContent).toMatch(/http-equiv=["']Content-Security-Policy["']/i);
    expect(htmlContent).toContain("default-src 'self'");
    expect(htmlContent).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(htmlContent).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(htmlContent).toContain("object-src 'none'");
    expect(htmlContent).toContain("frame-ancestors 'none'");
    expect(htmlContent).toContain("https://*.supabase.co");
  });

  it("index.html does not contain inline executable script blocks", () => {
    const htmlContent = fs.readFileSync(indexPath, "utf-8");
    // Inline script blocks like <script>alert(1)</script> or <script type="text/partytown">code</script> should not exist.
    // Allowed: <script src="..."> or <script type="module" src="...">
    const inlineScriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    const matches = Array.from(htmlContent.matchAll(inlineScriptRegex));
    const inlineContent = matches.map((m) => m[1].trim()).filter((content) => content.length > 0);

    expect(inlineContent.length).toBe(0);
  });

  it("vite.config.ts configures strict CSP for dev and preview servers", () => {
    const viteContent = fs.readFileSync(viteConfigPath, "utf-8");

    expect(viteContent).toContain("Content-Security-Policy");
    expect(viteContent).toContain("default-src 'self'");
    expect(viteContent).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(viteContent).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(viteContent).toContain("object-src 'none'");
  });

  it("public/_headers and public/serve.json configure strict CSP headers", () => {
    const headersContent = fs.readFileSync(publicHeadersPath, "utf-8");
    expect(headersContent).toContain("Content-Security-Policy");
    expect(headersContent).not.toMatch(/script-src[^;]*'unsafe-inline'/);

    const serveJsonContent = JSON.parse(fs.readFileSync(publicServeJsonPath, "utf-8"));
    const cspRule = serveJsonContent.headers?.[0]?.headers?.find(
      (h: { key: string }) => h.key === "Content-Security-Policy",
    );
    expect(cspRule).toBeDefined();
    expect(cspRule.value).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
