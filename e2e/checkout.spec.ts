/**
 * Playwright E2E Test: Stripe Checkout Flow
 * Verifies the end-to-end ticket purchasing process using Stripe test mode.
 *
 * Run with: npx playwright test checkout.spec.ts --headed
 */
import { test, expect } from "./analytics-fixture";
import { CheckoutPage } from "./page-objects/CheckoutPage";
import { generateTestEmail, TEST_EVENT_DETAILS } from "./fixtures/stripe-test-data";

test.describe("Stripe Checkout Flow", () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page);

    // Optional: Mock authentication or set up test user state here
    // await page.goto('/login');
    // await page.fill('input[name="email"]', generateTestEmail());
    // await page.fill('input[name="password"]', 'TestPassword123!');
    // await page.getByRole('button', { name: /log in/i }).click();
  });

  test("successfully purchases a ticket using Stripe test card", async ({ page }) => {
    // Step 1: Navigate to the test event page
    await checkoutPage.navigateToEvent(TEST_EVENT_DETAILS.slug);

    // Step 2: Click "Buy Ticket" to open Stripe Checkout
    await checkoutPage.initiateCheckout();

    // Step 3: Fill in the Stripe iframe with test card details
    // This uses frameLocator to pierce the iframe boundary securely
    await checkoutPage.fillStripePaymentDetails();

    // Step 4: Click the "Pay" button
    await checkoutPage.submitPayment();

    // Step 5: Assert successful redirection and confirmation message
    await checkoutPage.verifySuccess();
  });

  test("handles declined card gracefully", async ({ page }) => {
    // This test verifies that a declined test card (e.g., 4000 0000 0000 0002)
    // shows an appropriate error message without breaking the UI.
    await checkoutPage.navigateToEvent(TEST_EVENT_DETAILS.slug);
    await checkoutPage.initiateCheckout();

    const frame = await page.frameLocator(
      'iframe[title*="Secure payment"], iframe[name^="__privateStripeFrame"]',
    );
    const cardNumberInput = frame.locator('input[name="cardnumber"], input[placeholder*="card"]');

    await cardNumberInput.fill("4000 0000 0000 0002"); // Stripe test card for generic decline
    await frame.locator('input[name="exp-date"]').fill("12/34");
    await frame.locator('input[name="cvc"]').fill("123");

    const payButton = page.getByRole("button", { name: /pay|submit/i });
    await payButton.click();

    // Assert that an error message is displayed
    const errorMessage = page.getByText(/your card was declined|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Ensure we are still on the checkout page, not redirected to success
    await expect(page).not.toHaveURL(/.*\/success.*/);
  });
});
