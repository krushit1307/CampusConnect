import { test, expect } from "@playwright/test";

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "testuser@example.com",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Test User" },
};

test.describe("Club Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clubs");
  });

  test("should open club creation dialog", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create a club/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    const dialogTitle = page.getByRole("heading", { name: /create a new club/i });
    await expect(dialogTitle).toBeVisible();
  });

  test("should auto-generate slug from club name", async ({ page }) => {
    await page.getByRole("button", { name: /create a club/i }).click();

    const nameInput = page.getByPlaceholder(/AI Research Group/i);
    await nameInput.fill("My Awesome Club");

    const slugInput = page.getByPlaceholder(/ai-research-group/i);
    await expect(slugInput).toHaveValue("my-awesome-club");
  });

  test("should allow manual slug override", async ({ page }) => {
    await page.getByRole("button", { name: /create a club/i }).click();

    const nameInput = page.getByPlaceholder(/AI Research Group/i);
    await nameInput.fill("My Awesome Club");

    const slugInput = page.getByPlaceholder(/ai-research-group/i);
    await slugInput.fill("custom-slug");

    await expect(slugInput).toHaveValue("custom-slug");
  });

  test("should show validation errors for empty required fields", async ({ page }) => {
    await page.getByRole("button", { name: /create a club/i }).click();

    const submitButton = page.getByRole("button", { name: /submit club/i });
    await submitButton.click();

    const dialogTitle = page.getByRole("heading", { name: /create a new club/i });
    await expect(dialogTitle).toBeVisible();
  });

  test("should show description character count", async ({ page }) => {
    await page.getByRole("button", { name: /create a club/i }).click();

    const descriptionInput = page.getByPlaceholder(/Write about your club/i);
    await descriptionInput.fill("Hello");

    await expect(page.getByText(/5\//i)).toBeVisible();
  });

  test("should close dialog on escape key", async ({ page }) => {
    await page.getByRole("button", { name: /create a club/i }).click();

    await expect(page.getByRole("heading", { name: /create a new club/i })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { name: /create a new club/i })).not.toBeVisible();
  });

  test("should create a club when authenticated", async ({ page }) => {
    // Mock Supabase auth session
    await page.goto("/clubs");
    await page.evaluate(
      ([mockUser]) => {
        const key = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
        );
        if (key) {
          const existing = JSON.parse(localStorage.getItem(key) || "{}");
          existing.access_token = "mock-token";
          existing.user = mockUser;
          localStorage.setItem(key, JSON.stringify(existing));
        }
      },
      [MOCK_USER],
    );

    // Reload so the app picks up the mocked session
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Intercept the Supabase clubs insert
    await page.route("**/rest/v1/clubs**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: "mock-club-id" }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: /create a club/i }).click();

    await page.getByPlaceholder(/AI Research Group/i).fill("Test Club E2E");
    await page
      .getByPlaceholder(/Write about your club/i)
      .fill("A club created during E2E testing.");

    await page.getByRole("button", { name: /submit club/i }).click();

    // Wait for success toast
    await expect(page.getByText(/submitted for administrator review/i)).toBeVisible();
  });
});
