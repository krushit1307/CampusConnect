import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("HTTP Strict Transport Security (HSTS) Configuration", () => {
  it("vercel.json enforces Strict-Transport-Security header globally for production", () => {
    const vercelJsonPath = path.resolve(process.cwd(), "vercel.json");
    expect(fs.existsSync(vercelJsonPath)).toBe(true);

    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
    const globalHeaderRule = vercelConfig.headers?.find(
      (h: { source: string }) => h.source === "/(.*)",
    );
    expect(globalHeaderRule).toBeDefined();

    const hstsHeader = globalHeaderRule.headers?.find(
      (h: { key: string }) => h.key === "Strict-Transport-Security",
    );
    expect(hstsHeader).toBeDefined();
    expect(hstsHeader.value).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("public/_headers includes Strict-Transport-Security directive", () => {
    const headersPath = path.resolve(process.cwd(), "public/_headers");
    expect(fs.existsSync(headersPath)).toBe(true);

    const headersContent = fs.readFileSync(headersPath, "utf-8");
    expect(headersContent).toContain(
      "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    );
  });

  it("public/serve.json includes Strict-Transport-Security header", () => {
    const serveJsonPath = path.resolve(process.cwd(), "public/serve.json");
    expect(fs.existsSync(serveJsonPath)).toBe(true);

    const serveConfig = JSON.parse(fs.readFileSync(serveJsonPath, "utf-8"));
    const globalRule = serveConfig.headers?.find((h: { source: string }) => h.source === "**/*");
    expect(globalRule).toBeDefined();

    const hstsHeader = globalRule.headers?.find(
      (h: { key: string }) => h.key === "Strict-Transport-Security",
    );
    expect(hstsHeader).toBeDefined();
    expect(hstsHeader.value).toBe("max-age=63072000; includeSubDomains; preload");
  });
});
