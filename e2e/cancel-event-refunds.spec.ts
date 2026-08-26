import { test, expect } from "@playwright/test";

test.describe("Automated Event Cancellation Refund Orchestration", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the events dashboard (assuming organizer is authenticated via global setup)
    await page.goto("/events/evt-902");
  });

  test("should allow an organizer to cancel an event and orchestrate mass refunds", async ({
    page,
  }) => {
    // 1. Verify Danger Zone Button exists
    const dangerZoneBtn = page.getByRole("button", { name: /Cancel Event Danger Zone/i });
    await expect(dangerZoneBtn).toBeVisible();

    // 2. Open Danger Zone Modal
    await dangerZoneBtn.click();
    const modalHeading = page.getByRole("heading", { name: /Cancel Event & Issue Mass Refunds/i });
    await expect(modalHeading).toBeVisible();

    // 3. Fill out the reason for cancellation
    const reasonInput = page
      .locator("input")
      .filter({ hasText: "Reason for Cancellation" })
      .or(page.getByLabel("Reason for Cancellation"))
      .or(page.locator('input[type="text"]').first());
    await reasonInput.fill("Blizzard Warning");

    // 4. Fill out the confirmation text
    const confirmInput = page.getByPlaceholder("Type: CANCEL FALL MUSIC FEST & INDIE BAND CONCERT");
    await confirmInput.fill("CANCEL FALL MUSIC FEST & INDIE BAND CONCERT");

    // 5. Submit the cancellation
    const submitBtn = page.getByRole("button", { name: /Cancel Event & Refund All/i });
    await expect(submitBtn).toBeEnabled();

    // Intercept the Edge Function API call to mock the response
    await page.route("**/functions/v1/cancel-event-refunds", async (route) => {
      const json = {
        success: true,
        message: "Successfully cancelled event and orchestrated 200 refunds.",
        total_rsvps_cancelled: 200,
        total_paid_refunds: 150,
        total_refunded_amount_cents: 300000,
      };
      await route.fulfill({ json });
    });

    await submitBtn.click();

    // 6. Assert success state
    await expect(
      page.getByRole("heading", { name: /Event Cancelled & Refunds Issued/i }),
    ).toBeVisible();
    await expect(page.getByText("Total RSVPs Cancelled: 200")).toBeVisible();
    await expect(page.getByText("Total Refunded: $3000")).toBeVisible();

    // 7. Click Done and ensure modal closes
    const doneBtn = page.getByRole("button", { name: /Done/i });
    await doneBtn.click();
    await expect(modalHeading).not.toBeVisible();
  });
});
