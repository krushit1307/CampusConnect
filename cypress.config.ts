import { defineConfig } from "cypress";
import react from "@vitejs/plugin-react";

/**
 * Cypress configuration supporting dual modes:
 *  - e2e: end-to-end integration tests with artifact capture (videos & screenshots)
 *  - component: Component Testing (CT) using Vite to mount React components.
 */
export default defineConfig({
  e2e: {
    specPattern: ["cypress/e2e/**/*.cy.{ts,tsx}", "cypress/e2e/**/*.spec.{ts,tsx}"],
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videoCompression: 32,
    trashAssetsBeforeRuns: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // E2E specific node events
    },
  },
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
      viteConfig: {
        plugins: [react()],
        resolve: {
          alias: {
            "@": "/src",
          },
        },
        server: {
          fs: {
            strict: false,
          },
        },
      },
    },
    specPattern: ["cypress/component/**/*.cy.{ts,tsx}", "src/**/*.cy.{ts,tsx}"],
    supportFile: "cypress/support/component.tsx",
    indexHtmlFile: "cypress/support/component-index.html",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
  },
  // Common global settings
  viewportWidth: 1280,
  viewportHeight: 720,
  video: true,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
