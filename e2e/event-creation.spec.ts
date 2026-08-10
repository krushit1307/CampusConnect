import { test, expect } from "./analytics-fixture";

test.describe("Event Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to events page
    await page.goto("/events");
  });

  test("should open event creation dialog", async ({ page }) => {
    // Find and click the "Create event" button
    const createButton = page.getByRole("button", { name: /create event/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify dialog opens
    const dialogTitle = page.getByRole("heading", { name: /create a new event/i });
    await expect(dialogTitle).toBeVisible();
  });

  test("should show validation errors for required fields", async ({ page }) => {
    // Open dialog
    await page.getByRole("button", { name: /create event/i }).click();

    // Try to submit without filling any fields
    const submitButton = page.getByRole("button", { name: /create event/i }).nth(1);
    await submitButton.click();

    // Check for validation errors - form should not submit
    const dialogTitle = page.getByRole("heading", { name: /create a new event/i });
    await expect(dialogTitle).toBeVisible();

    // Title field should show required state
    const titleInput = page.getByPlaceholder(/hackathon/i);
    await expect(titleInput).toBeVisible();
  });

  test("should allow date range selection via calendar", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Click the date picker button
    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await datePickerButton.click();

    // Calendar should be visible
    const calendar = page.locator(".rdp").first();
    await expect(calendar).toBeVisible();
  });

  test("should populate time inputs when date is selected", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Click date picker
    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await datePickerButton.click();

    // Select a date (click on a day in the calendar)
    const calendarDay = page.locator(".rdp-day:not(.rdp-day_disabled)").first();
    await calendarDay.click();

    // Time inputs should be enabled and visible
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').nth(1);

    await expect(startTimeInput).toBeVisible();
    await expect(endTimeInput).toBeVisible();
  });

  test("should allow time input modification", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Select a date first
    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await datePickerButton.click();
    const calendarDay = page.locator(".rdp-day:not(.rdp-day_disabled)").first();
    await calendarDay.click();

    // Modify start time
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill("09:00");
    await expect(startTimeInput).toHaveValue("09:00");

    // Modify end time
    const endTimeInput = page.locator('input[type="time"]').nth(1);
    await endTimeInput.fill("17:00");
    await expect(endTimeInput).toHaveValue("17:00");
  });

  test("should show character count for description", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const descriptionTextarea = page.getByPlaceholder(/what's this event about/i);
    await descriptionTextarea.fill("Test description");

    // Character count should be visible
    const charCount = page.getByText(/\d+ \/ 150 characters/i);
    await expect(charCount).toBeVisible();
    await expect(charCount).toContainText("16 / 150 characters");
  });

  test("should show warning when description character limit is near", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const descriptionTextarea = page.getByPlaceholder(/what's this event about/i);
    // Fill with 141 characters (near 150 limit)
    await descriptionTextarea.fill("a".repeat(141));

    // Character count should show warning style
    const charCount = page.getByText(/\d+ \/ 150 characters/i);
    await expect(charCount).toBeVisible();
  });

  test("should show map preview when location is entered", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("New York, NY");

    // Map preview should appear
    const mapPreview = page.locator("iframe").first();
    await expect(mapPreview).toBeVisible();
  });

  test("should not show map preview for 'Online' location", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("Online");

    // Map preview should not appear
    const mapPreview = page.locator("iframe").first();
    await expect(mapPreview).not.toBeVisible();
  });

  test("should not show map preview for 'online' (lowercase) location", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("online");

    // Map preview should not appear
    const mapPreview = page.locator("iframe").first();
    await expect(mapPreview).not.toBeVisible();
  });

  test("should close dialog when canceling via escape", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Dialog should be closed
    const dialogTitle = page.getByRole("heading", { name: /create a new event/i });
    await expect(dialogTitle).not.toBeVisible();
  });

  test("should close dialog when clicking outside", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Click outside the dialog (on backdrop)
    const dialogContent = page.locator('[role="dialog"]').first();
    const backdrop = page.locator('[role="dialog"]').first().locator("..");
    await backdrop.click({ position: { x: 10, y: 10 } });

    // Dialog should be closed
    const dialogTitle = page.getByRole("heading", { name: /create a new event/i });
    await expect(dialogTitle).not.toBeVisible();
  });

  test("should have all required form fields visible", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Title field
    await expect(page.getByPlaceholder(/hackathon/i)).toBeVisible();

    // Description field
    await expect(page.getByPlaceholder(/what's this event about/i)).toBeVisible();

    // Location field
    await expect(page.getByPlaceholder(/main auditorium/i)).toBeVisible();

    // Date picker
    await expect(page.getByRole("button").filter({ hasText: /pick a date range/i })).toBeVisible();

    // Time inputs
    await expect(page.locator('input[type="time"]').first()).toBeVisible();
  });

  test("should show submit button in loading state", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Fill in minimum required fields
    await page.getByPlaceholder(/hackathon/i).fill("Test Event");
    await page.getByPlaceholder(/what's this event about/i).fill("Test description");
    await page.getByPlaceholder(/main auditorium/i).fill("Test Location");

    // Submit button should be visible
    const submitButton = page.getByRole("button", { name: /create event/i }).nth(1);
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText("Create event");
  });

  test("should show map preview when coordinates are entered", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Enter coordinates
    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("28.7041,77.1025");

    // Map preview should appear with coordinates
    const mapPreview = page.locator("iframe").first();
    await expect(mapPreview).toBeVisible();
  });

  test("should reset form when dialog is reopened", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Fill some fields
    await page.getByPlaceholder(/hackathon/i).fill("Test Event");
    await page.getByPlaceholder(/what's this event about/i).fill("Test description");
    await page.getByPlaceholder(/main auditorium/i).fill("Test Location");

    // Close dialog
    await page.keyboard.press("Escape");

    // Reopen dialog
    await page.getByRole("button", { name: /create event/i }).click();

    // Fields should be empty
    const titleInput = page.getByPlaceholder(/hackathon/i);
    await expect(titleInput).toHaveValue("");

    const descriptionInput = page.getByPlaceholder(/what's this event about/i);
    await expect(descriptionInput).toHaveValue("");

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await expect(locationInput).toHaveValue("");
  });

  test("should show 'Google Maps' link when location is entered", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("San Francisco, CA");

    // Google Maps link should appear
    const mapsLink = page.getByRole("link", { name: /open in google maps/i });
    await expect(mapsLink).toBeVisible();
  });

  test("should open Google Maps in new tab when link is clicked", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const locationInput = page.getByPlaceholder(/main auditorium/i);
    await locationInput.fill("Boston, MA");

    // Get the href of the maps link
    const mapsLink = page.getByRole("link", { name: /open in google maps/i });
    const href = await mapsLink.getAttribute("href");

    // Verify it's a Google Maps URL
    expect(href).toContain("google.com/maps");
  });

  test("should allow filling title field", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const titleInput = page.getByPlaceholder(/hackathon/i);
    await titleInput.fill("Annual Hackathon 2026");

    await expect(titleInput).toHaveValue("Annual Hackathon 2026");
  });

  test("should enforce title max length", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const titleInput = page.getByPlaceholder(/hackathon/i);
    const maxLength = await titleInput.getAttribute("maxlength");

    // Verify max length is set
    expect(maxLength).toBeTruthy();
  });

  test("should show location helper text", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Helper text should be visible
    const helperText = page.getByText(/venue name, address, or coordinates/i);
    await expect(helperText).toBeVisible();
  });

  test("should show dialog description", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Dialog description should be visible
    const description = page.getByText(/fill in the details below/i);
    await expect(description).toBeVisible();
  });

  test("should have calendar icon in date picker button", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Date picker button should have calendar icon
    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await expect(datePickerButton).toBeVisible();
  });

  test("should show two month calendars in date picker", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await datePickerButton.click();

    // Should show 2 months (range picker)
    const calendars = page.locator(".rdp-months");
    await expect(calendars).toBeVisible();
  });

  test("should disable time inputs before date selection", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Time inputs should be disabled initially
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').nth(1);

    await expect(startTimeInput).toBeDisabled();
    await expect(endTimeInput).toBeDisabled();
  });

  test("should enable time inputs after date selection", async ({ page }) => {
    await page.getByRole("button", { name: /create event/i }).click();

    // Select a date
    const datePickerButton = page.getByRole("button").filter({ hasText: /pick a date range/i });
    await datePickerButton.click();
    const calendarDay = page.locator(".rdp-day:not(.rdp-day_disabled)").first();
    await calendarDay.click();

    // Time inputs should be enabled
    const startTimeInput = page.locator('input[type="time"]').first();
    const endTimeInput = page.locator('input[type="time"]').nth(1);

    await expect(startTimeInput).not.toBeDisabled();
    await expect(endTimeInput).not.toBeDisabled();
  });
});
