import { defineConfig } from "cypress";
import react from "@vitejs/plugin-react";

/**
 * Cypress configuration supporting dual modes:
 *  - e2e: end-to-end integration tests
 *  - component: Component Testing (CT) using Vite to mount React components,
 *    resolve path aliases (@), and handle custom assets/styling.
 */
export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 720,
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
    supportFile: "cypress/support/component.ts",
    indexHtmlFile: "cypress/support/component-index.html",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
  },
  // Common global settings
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
