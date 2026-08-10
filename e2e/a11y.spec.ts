import { test, expect } from "./analytics-fixture";
import AxeBuilder from "@axe-core/playwright";

test.describe("Automated Accessibility (a11y) Audits", () => {
  test("should have no critical or serious accessibility violations on Login Page (/auth)", async ({
    page,
  }) => {
    await page.goto("/auth");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude("iframe") // Exclude third-party IFrames (Stripe, YouTube embeds, etc.)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (criticalOrSerious.length > 0) {
      console.error(
        "Accessibility Violations Found on Login Page:",
        JSON.stringify(criticalOrSerious, null, 2),
      );
    }

    expect(criticalOrSerious).toEqual([]);
  });

  test("should audit critical path views (Login -> Dashboard -> Feed) without critical violations", async ({
    page,
  }) => {
    const routesToAudit = ["/auth", "/dashboard", "/feed"];

    for (const route of routesToAudit) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const scanResults = await new AxeBuilder({ page })
        .exclude("iframe")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const violations = scanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      if (violations.length > 0) {
        console.error(`Accessibility Violations on ${route}:`, JSON.stringify(violations, null, 2));
      }

      expect(violations).toEqual([]);
    }
  });
});
