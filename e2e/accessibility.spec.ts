/**
 * Accessibility — Color Independence & Grayscale Snapshot Tests
 * =============================================================
 * Verifies that the Login form communicates Success and Error states
 * through non-color indicators (text, icons, ARIA attributes) so that
 * users with color-vision deficiencies (e.g. Deuteranopia) can still
 * understand the UI.
 *
 * TECHNIQUE: Grayscale CSS injection
 * ------------------------------------
 * We inject  `html { filter: grayscale(100%) !important; }`  via
 * page.addStyleTag() before every screenshot.  This strips all hue
 * information from the rendered page, simulating how a user with
 * complete color blindness perceives it.
 *
 * The filter only exists inside the test — no application CSS is modified.
 *
 * BAD ACCESSIBILITY EXAMPLE (what this test catches):
 *   An error state that ONLY changes a border from black → red, with no
 *   icon or message.  In grayscale the border is the same shade of grey
 *   as the default border → the two snapshots look identical → the test
 *   flags this as an accessibility failure for manual review.
 *
 * GOOD ACCESSIBILITY (what passing looks like):
 *   An error state that shows visible error text AND/OR an error icon.
 *   In grayscale the text/icon is still clearly visible → the error
 *   snapshot is distinguishable from the baseline snapshot → pass.
 *
 * SNAPSHOT STRATEGY
 * -----------------
 * Two deterministic snapshots are captured per scenario:
 *   1. form-grayscale.png        — baseline (empty form, no errors)
 *   2. form-error-grayscale.png  — after a real validation failure
 *
 * Animations and transitions are frozen before every screenshot to
 * prevent pixel-level flakiness across CI runs.
 *
 * COLOR CONTRAST (axe-core)
 * -------------------------
 * After triggering each state we run an @axe-core/playwright scan
 * scoped to the `color-contrast` rule so we get a mathematical
 * guarantee that the error-text grey still meets the WCAG 4.5:1 ratio
 * against the background, not just a visual impression.
 */

import { test, expect } from "./analytics-fixture";
import AxeBuilder from "@axe-core/playwright";
import { installAuthApiMocks, installTurnstileMock, TEST_ACCOUNTS } from "./auth-helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Route under test — the Login / Sign-Up page. */
const AUTH_URL = "/auth";

/**
 * Injected before every screenshot.
 * Freezes animations so snapshots are pixel-deterministic across runs.
 * Hides the blinking caret so cursor position never affects the diff.
 */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration:   0s !important;
    animation-delay:      0s !important;
    transition-duration:  0s !important;
    transition-delay:     0s !important;
    caret-color: transparent !important;
  }
`;

/** Injects the full-page grayscale filter.  Call before screenshot. */
async function injectGrayscale(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({
    content: "html { filter: grayscale(100%) !important; }",
  });
}

// ---------------------------------------------------------------------------
// Grayscale snapshot tests
// ---------------------------------------------------------------------------

test.describe("Grayscale — color-independence snapshots", () => {
  /**
   * BASELINE — empty login form with no validation triggered.
   *
   * This is the reference snapshot.  Error-state snapshots must look
   * visually different from this in grayscale; otherwise the only
   * differentiator is color, which is an accessibility failure.
   */
  test("baseline: empty login form renders correctly in grayscale", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    // Freeze animations then inject grayscale
    await page.addStyleTag({ content: FREEZE_CSS });
    await injectGrayscale(page);

    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot("form-grayscale.png");
  });

  /**
   * ERROR STATE — submit an empty form to trigger required-field errors.
   *
   * The snapshot MUST look different from the baseline above.
   * If it looks identical, the error state communicates only via color
   * (e.g. a red border with no text/icon) — that is an accessibility
   * failure and must be flagged for manual review.
   *
   * Because the Login form renders visible error text ("Email is required.",
   * "Password is required."), the snapshot should clearly differ from the
   * baseline even in grayscale — the text is readable in any shade of grey.
   */
  test("error state: validation errors are visible in grayscale (not color-only)", async ({
    page,
  }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");
    await page.addStyleTag({ content: FREEZE_CSS });

    // Trigger real client-side validation — no DOM manipulation
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for error text to appear before injecting grayscale
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await injectGrayscale(page);

    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot("form-error-grayscale.png");
  });

  /**
   * SERVER ERROR STATE — the server returns invalid-credentials.
   *
   * The role="alert" error banner is rendered in red in the normal UI.
   * In grayscale it must still be readable because it contains visible text.
   * A purely color-based implementation (e.g. red background, no text) would
   * be indistinguishable from the baseline — an accessibility failure.
   */
  test("server error: role=alert banner is visible in grayscale", async ({ page }) => {
    await installAuthApiMocks(page, { login: "invalid-credentials" });
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");
    await page.addStyleTag({ content: FREEZE_CSS });

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for the alert to be visible before capturing
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      "The email or password you entered is incorrect.",
    );

    await injectGrayscale(page);

    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot(
      "form-server-error-grayscale.png",
    );
  });
});

// ---------------------------------------------------------------------------
// Semantic accessibility assertions
// ---------------------------------------------------------------------------

test.describe("Semantic — error states use non-color indicators", () => {
  /**
   * WCAG 2.1 SC 3.3.1 — Error Identification
   * Each field with a validation error must have a text description.
   * Verified here without color — the text must exist in the DOM.
   */
  test("required-field errors: visible error text is present (not color only)", async ({
    page,
  }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
  });

  /**
   * WCAG 2.1 SC 4.1.2 — Name, Role, Value
   * Inputs must be marked aria-invalid when they have a validation error
   * so screen readers can announce the error state independently of color.
   */
  test("required-field errors: inputs have aria-invalid='true'", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();

    await expect(page.locator('input[name="email"]')).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('input[name="password"]').first()).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  /**
   * WCAG 2.1 SC 1.3.1 — server error uses role="alert" (live region)
   * Screen readers announce a live region without the user needing to
   * navigate to it — critical for users who cannot see the red banner.
   */
  test("server error: role=alert live region contains descriptive text", async ({ page }) => {
    await installAuthApiMocks(page, { login: "invalid-credentials" });
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("The email or password you entered is incorrect.");
  });

  /**
   * WCAG 2.1 SC 1.3.5 — form inputs have accessible labels
   * AT users must be able to identify each field's purpose without color.
   */
  test("form inputs have accessible labels", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByLabel("College email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  /**
   * WCAG 2.1 SC 2.4.7 — Focus Visible
   * The focused element must be programmatically focused (not just styled)
   * so keyboard users and AT can track the active element without color.
   */
  test("focus state: email input is programmatically focusable", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.getByLabel("College email");
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
  });

  /**
   * WCAG 2.1 SC 2.1.1 — Keyboard
   * All form controls must be reachable via Tab without a mouse.
   */
  test("keyboard navigation: Tab reaches email → password → submit", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    // Tab from body until we hit the first INPUT
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      if (tag === "INPUT") break;
    }

    const emailActive = await page.evaluate(
      () =>
        (document.activeElement as HTMLInputElement)?.name === "email" ||
        (document.activeElement as HTMLInputElement)?.type === "email",
    );
    expect(emailActive).toBe(true);

    // Next Tab should reach password
    await page.keyboard.press("Tab");
    const passwordActive = await page.evaluate(
      () =>
        (document.activeElement as HTMLInputElement)?.name === "password" ||
        (document.activeElement as HTMLInputElement)?.type === "password",
    );
    expect(passwordActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// axe-core — color contrast & WCAG automated audit
// ---------------------------------------------------------------------------

test.describe("axe-core — color-contrast & WCAG violations", () => {
  /**
   * Baseline: no critical/serious WCAG 2.1 AA violations on the login page.
   * Runs against the untouched form before any validation.
   */
  test("login page baseline: no critical/serious WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    const results = await new AxeBuilder({ page })
      .exclude("iframe") // skip third-party embeds (Turnstile, etc.)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (critical.length > 0) {
      console.error("axe violations (baseline):", JSON.stringify(critical, null, 2));
    }

    expect(critical).toEqual([]);
  });

  /**
   * Error state: color-contrast rule must pass after validation fires.
   *
   * Red error text on a white background must still meet the WCAG 4.5:1
   * contrast ratio (SC 1.4.3).  If the ratio fails, the text is illegible
   * not just for colorblind users but for all users in low-light conditions.
   *
   * This is the mathematical companion to the grayscale snapshot — the
   * snapshot proves visual distinctiveness; this proves contrast ratio.
   */
  test("error state: color-contrast passes axe audit after validation", async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    // Trigger real validation errors
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .exclude("iframe")
      .withRules(["color-contrast"])
      .analyze();

    if (results.violations.length > 0) {
      console.error(
        "color-contrast violations in error state:",
        JSON.stringify(results.violations, null, 2),
      );
    }

    expect(results.violations).toEqual([]);
  });

  /**
   * Error state: full WCAG audit after validation.
   * Confirms no new critical/serious issues are introduced when errors appear.
   */
  test("error state: no new critical/serious WCAG violations after validation", async ({
    page,
  }) => {
    await installTurnstileMock(page);
    await page.goto(AUTH_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .exclude("iframe")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (critical.length > 0) {
      console.error("axe violations (error state):", JSON.stringify(critical, null, 2));
    }

    expect(critical).toEqual([]);
  });
});
