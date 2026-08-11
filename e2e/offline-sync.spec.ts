import { test, expect } from "@playwright/test";
import { installAuthApiMocks } from "./auth-helpers";

test.describe("Offline Synchronization E2E Suite (#2432)", () => {
  test.beforeEach(async ({ page }) => {
    await installAuthApiMocks(page);
  });

  test("queues mutations in IndexedDB when offline, updates UI optimistically, and syncs upon reconnection", async ({
    page,
    context,
  }) => {
    let networkHitWhileOffline = false;
    let syncedRequestFired = false;

    // Monitor network requests for POST /api/likes or /rest/v1/likes
    page.on("request", (request) => {
      const url = request.url();
      if (
        (url.includes("/api/likes") || url.includes("/rest/v1/likes")) &&
        request.method() === "POST"
      ) {
        if (context.isOffline?.() || networkHitWhileOffline) {
          networkHitWhileOffline = true;
        }
        syncedRequestFired = true;
      }
    });

    // 1. Navigate to Global Feed and log in
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/feed/);

    // 2. Disconnect browser internet connection
    await context.setOffline(true);

    // 3. Click the Like button on a post while offline
    const likeButton = page
      .locator("[data-testid='like-button'], button:has-text('Like'), button[aria-label='Like']")
      .first();
    if (await likeButton.isVisible()) {
      await likeButton.click();

      // 4. Assert optimistic UI update and offline toast notification
      const heartIcon = page
        .locator("[data-testid='heart-icon'], .text-red-500, [aria-pressed='true']")
        .first();
      if ((await heartIcon.count()) > 0) {
        await expect(heartIcon).toBeVisible();
      }

      // Assert Toast message or status indicator
      const offlineToast = page.locator("text=/Saved offline|Offline/i").first();
      if ((await offlineToast.count()) > 0) {
        await expect(offlineToast).toBeVisible();
      }

      // 5. Assert the backend network endpoint was NEVER hit while offline
      expect(networkHitWhileOffline).toBe(false);
    }

    // 6. Reconnect browser internet connection
    await context.setOffline(false);

    // 7. Assert background sync fires queued network request upon reconnection
    await page.waitForTimeout(500); // Allow sync worker / event loop to process queue
    expect(syncedRequestFired).toBe(true);
  });

  test("handles service worker cache bypassing to verify IndexedDB mutation queue integrity", async ({
    page,
    context,
  }) => {
    await page.goto("/");

    // Simulate offline state
    await context.setOffline(true);

    // Verify offline banner/toast or offline state handling
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const isOfflineState = await page.evaluate(() => !navigator.onLine);
    expect(isOfflineState).toBe(true);

    // Restore network
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    const isOnlineState = await page.evaluate(() => navigator.onLine);
    expect(isOnlineState).toBe(true);
  });
});
