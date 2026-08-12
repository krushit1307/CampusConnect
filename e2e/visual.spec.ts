import { test, expect } from "@playwright/test";

test.describe("Visual Regression: Core Pages", () => {
  // Use a fixed viewport for consistent screenshots
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    // Mock the GraphQL endpoint to return standard static data for all visual tests
    await page.route("*/**/graphql", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // We can inspect the operationName and mock accordingly,
      // but for visual tests where we just want the layout to remain static,
      // we can return a generic mocked response or let it pass if we are
      // relying on a seeded DB. If relying on DB, we might mask elements.

      // Let's pass the request for now and rely on masking dynamic content.
      await route.continue();
    });
  });

  const getMaskOptions = (page: any) => ({
    // Mask typical dynamic elements like dates, timestamps, or dynamic feeds
    mask: [
      page.locator(".dynamic-timestamp"),
      page.locator(".user-avatar"),
      page.locator('[data-testid="feed-timestamp"]'),
    ],
    animations: "disabled" as const,
    fullPage: true,
  });

  test("Home Page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home-page.png", getMaskOptions(page));
  });

  test("Login Page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login-page.png", getMaskOptions(page));
  });

  test("Profile Page", async ({ page }) => {
    // Assuming /profile or /profile/me redirects, let's use a known static profile path if possible
    await page.goto("/profile/test-user");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("profile-page.png", getMaskOptions(page));
  });

  test("Feed Page", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("feed-page.png", getMaskOptions(page));
  });

  test("Directory Page", async ({ page }) => {
    await page.goto("/directory");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("directory-page.png", getMaskOptions(page));
  });
});
