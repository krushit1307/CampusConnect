import { test, expect } from "./analytics-fixture";

test("asynchronous bulk newsletter queue dispatch and status polling", async ({ page }) => {
  // 1. Authenticate User (Admin of Tech Club)
  await page.goto("/auth");
  await page.locator('input[placeholder="you@college.edu"]').fill("admin@campusconnect.edu");
  await page.locator('input[placeholder="********"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // 2. Navigate to Tech Club details page
  await page.goto("/clubs/tech-club");
  await page.waitForLoadState("networkidle");

  // 3. Verify the Club Newsletter Dispatcher admin interface is visible
  const dispatcherHeading = page.getByRole("heading", { name: "Club Newsletter Dispatcher" });
  await expect(dispatcherHeading).toBeVisible({ timeout: 10000 });

  // 4. Trigger newsletter send
  const sendButton = page.getByRole("button", { name: "Send Newsletter Now" });
  await expect(sendButton).toBeVisible();
  await sendButton.click();

  // 5. Verify the UI responds instantly with the success toast notification
  const toastNotification = page.locator("text=Newsletter queued successfully!");
  await expect(toastNotification).toBeVisible();

  // 6. Verify that the background status tracker updates immediately to pending/processing
  const statusTracker = page.locator("text=Status:");
  await expect(statusTracker).toBeVisible();

  const statusText = page.locator("text=PENDING").or(page.locator("text=PROCESSING"));
  await expect(statusText).toBeVisible();
});
