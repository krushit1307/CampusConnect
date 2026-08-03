import { describe, it, expect } from "vitest";
import * as path from "path";

/**
 * Smoke checks for cypress.config.ts (issue #1851).
 *
 * We don't actually run Cypress here — that needs the bundled Chrome
 * binary and the @cypress/vite-dev-server dev server, which CI
 * exercises via `pnpm test:cypress:component`. These tests just
 * catch obvious configuration regressions (removed specPattern,
 * flipped viewport, accidentally-overridden mode config) by
 * parsing the config file and asserting on its shape.
 */
const configModule = await import(path.resolve(process.cwd(), "cypress.config.ts"));
const config = configModule.default as {
  e2e?: { specPattern?: string; supportFile?: string; baseUrl?: string };
  component?: {
    specPattern?: string;
    supportFile?: string;
    indexHtmlFile?: string;
  };
  viewportWidth?: number;
  viewportHeight?: number;
  video?: boolean;
  screenshotOnRunFailure?: boolean;
  retries?: unknown;
};
describe("cypress.config.ts (issue #1851)", () => {
  it("exposes both e2e and component modes", () => {
    expect(config.e2e).toBeDefined();
    expect(config.component).toBeDefined();
  });

  it("points e2e specPattern at cypress/e2e", () => {
    expect(config.e2e?.specPattern).toBe("cypress/e2e/**/*.cy.{ts,tsx}");
  });

  it("points component specPattern at cypress/component", () => {
    expect(config.component?.specPattern).toBe("cypress/component/**/*.cy.{ts,tsx}");
  });

  it("uses the e2e support file for e2e", () => {
    expect(config.e2e?.supportFile).toBe("cypress/support/e2e.ts");
  });

  it("uses a separate component support file for CT", () => {
    expect(config.component?.supportFile).toBe("cypress/support/component.ts");
  });

  it("configures the component iframe mount target", () => {
    expect(config.component?.indexHtmlFile).toBe("cypress/support/component-index.html");
  });

  it("sets the e2e baseUrl to localhost:5173", () => {
    expect(config.e2e?.baseUrl).toBe("http://localhost:5173");
  });

  it("sets a sensible default viewport", () => {
    expect(config.viewportWidth).toBe(1280);
    expect(config.viewportHeight).toBe(720);
  });

  it("records video off (avoids generating huge artifacts in CI)", () => {
    expect(config.video).toBe(false);
  });

  it("captures screenshots on failure for both modes", () => {
    expect(config.screenshotOnRunFailure).toBe(true);
  });

  it("retries once in headless runs to absorb CI flakes", () => {
    const retries = config.retries as { runMode?: number; openMode?: number } | number | undefined;
    // Cypress accepts retries as either a number (apply to both modes)
    // or an object with per-mode overrides. We accept either form.
    if (typeof retries === "number") {
      expect(retries).toBeGreaterThanOrEqual(0);
    } else {
      expect(retries?.runMode).toBe(1);
    }
  });
});
