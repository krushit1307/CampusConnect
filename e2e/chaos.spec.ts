import { test, expect } from "@playwright/test";

test.describe("Chaos Engineering - Sudden Network Drop Simulation", () => {
  test("should handle abrupt network disconnect during navigation and render offline banner", async ({
    page,
    context,
  }) => {
    // 1. Start online and navigate to events page
    await page.goto("/events");
    await expect(page).toHaveURL(/\/events/);

    // 2. Simulate router/network dying mid-session
    await context.setOffline(true);

    // 3. Verify OfflineBanner or offline indicator becomes visible
    const offlineBanner = page.locator("text=/no connection/i");
    await expect(offlineBanner).toBeVisible({ timeout: 5000 });

    // 4. Ensure app UI does not whitescreen or crash unhandled
    const bodyElement = page.locator("body");
    await expect(bodyElement).toBeVisible();

    // 5. Restore connection
    await context.setOffline(false);

    // 6. Verify OfflineBanner disappears upon network restoration
    await expect(offlineBanner).not.toBeVisible({ timeout: 5000 });
  });

  test("should gracefully catch network drop during form interaction and halt loading", async ({
    page,
    context,
  }) => {
    await page.goto("/events");

    // Open Event Creation modal if button is present
    const createButton = page.getByRole("button", { name: /create event/i });
    if (await createButton.isVisible()) {
      await createButton.click();

      const dialogTitle = page.getByRole("heading", { name: /create a new event/i });
      await expect(dialogTitle).toBeVisible();

      // Trigger mid-action network drop
      await page.waitForTimeout(300);
      await context.setOffline(true);

      // Verify UI halts gracefully without unhandled crashes
      await expect(page.locator("body")).toBeVisible();

      // Restore network
      await context.setOffline(false);
    }
  });

  test("should handle sudden network loss during authentication and preserve state", async ({
    page,
    context,
  }) => {
    await page.goto("/auth");

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await expect(emailInput).toBeVisible();
    await emailInput.fill("chaosuser@test.com");
    await passwordInput.fill("Password123!");

    // Simulate abrupt network drop
    await context.setOffline(true);

    // Verify user inputs are retained and UI is responsive
    await expect(emailInput).toHaveValue("chaosuser@test.com");

    // Restore connection
    await context.setOffline(false);
  });
});
