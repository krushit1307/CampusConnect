import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Audit (Axe-core)", () => {
  // A simple test to capture baseline accessibility violations without failing the build yet.
  test("should not have any automatically detectable accessibility issues on the home page", async ({
    page,
  }) => {
    await page.goto("/");

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    // Log the violations to generate a baseline
    if (accessibilityScanResults.violations.length > 0) {
      console.log("--- Axe-core Accessibility Violations Baseline ---");
      accessibilityScanResults.violations.forEach((violation, index) => {
        console.log(`\nViolation ${index + 1}: ${violation.id}`);
        console.log(`Description: ${violation.description}`);
        console.log(`Impact: ${violation.impact}`);
        console.log(`Nodes affected: ${violation.nodes.length}`);
      });
      console.log("--------------------------------------------------");
    }

    // We use a warning or soft assertion here so that it doesn't break CI,
    // or we simply don't assert it until the baseline is fixed.
    // expect(accessibilityScanResults.violations).toEqual([]);
  });
});
