import { defineConfig } from "cypress";
import { devServer } from "@cypress/vite-dev-server";
import type { ViteDevServerConfig } from "@cypress/vite-dev-server";

/**
 * Cypress config (issue #1851).
 *
 * Supports BOTH modes:
 *  - e2e: the existing flow tests under cypress/e2e/*.cy.ts
 *  - component: new CT tests under cypress/component/*.cy.tsx that
 *    mount a single component in a real Chrome browser for tests
 *    that need canvas / pointer / WebGL APIs that jsdom can't fake.
 *
 * Switching between the two modes:
 *   cypress run --component       # component testing
 *   cypress run                   # e2e
 *
 * For the component mode we register a vite dev server via the
 * setupNodeEvents hook so the mounted component inherits the
 * project's Vite config (Tailwind, path aliases, etc.).
 */
export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    baseUrl: "http://localhost:5173",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 720,
  },
  component: {
    specPattern: "cypress/component/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/component.ts",
    indexHtmlFile: "cypress/support/component-index.html",
    devServer: (config: ViteDevServerConfig) =>
      devServer.create(config, undefined).then(() => undefined),
  },
  // Common settings for both modes.
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
