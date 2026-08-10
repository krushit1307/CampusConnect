import { test, expect } from "./analytics-fixture";

test.describe("Visual Regression: Auth Pages", () => {
  test("login page full layout", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("auth-login.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("forgot password page", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("auth-forgot-password.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual Regression: Navigation", () => {
  test("navbar renders correctly", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const navbar = page.locator("nav").first();
    await expect(navbar).toHaveScreenshot("navbar.png");
  });

  test("footer renders correctly", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const footer = page.locator("footer").first();
    await expect(footer).toHaveScreenshot("footer.png");
  });
});

test.describe("Visual Regression: Events Page", () => {
  test("events listing layout", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot("events-listing.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual Regression: Not Found Page", () => {
  test("404 page renders correctly", async ({ page }) => {
    await page.goto("/nonexistent-route");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("404-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});

test.describe("Visual Regression: Dark Mode", () => {
  test("events page in dark mode", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");
    const darkModeToggle = page
      .locator("button")
      .filter({ hasText: /theme|dark|light/i })
      .first();
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
    }
    await expect(page).toHaveScreenshot("events-dark-mode.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
