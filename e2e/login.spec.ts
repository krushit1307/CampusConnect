import { test, expect } from "@playwright/test";

test("login page renders correctly", async ({ page }) => {
  await page.goto("/auth");

  // Verify that the Email and Password inputs are present on the screen
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
});
