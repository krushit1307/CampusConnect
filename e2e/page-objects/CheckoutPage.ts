/**
 * Checkout Page Object Model
 * Encapsulates interactions with the Stripe checkout flow for cleaner test code.
 */
import { Page, expect } from "@playwright/test";
import { STRIPE_TEST_CARD, waitForStripeFrame } from "../fixtures/stripe-test-data";

export class CheckoutPage {
    constructor(private page: Page) { }

    async navigateToEvent(eventSlug: string) {
        await this.page.goto(`/events/${eventSlug}`);
        await expect(this.page).toHaveURL(new RegExp(`/events/${eventSlug}`));
        await expect(this.page.locator("h1")).toContainText("Test Event for Checkout", { timeout: 10000 });
    }

    async initiateCheckout() {
        const buyButton = this.page.getByRole("button", { name: /buy ticket/i });
        await expect(buyButton).toBeVisible();
        await buyButton.click();

        // Wait for the Stripe modal or redirect to appear
        await this.page.waitForTimeout(2000); // Allow modal animation/redirect
    }

    async fillStripePaymentDetails() {
        const frame = await waitForStripeFrame(this.page);

        // Target the specific input fields within the Stripe iframe
        // Note: Stripe's DOM structure may vary slightly, but these data-testids or names are standard
        const cardNumberInput = frame.locator('input[name="cardnumber"], input[placeholder*="card"], input[aria-label*="card"]');
        const expiryInput = frame.locator('input[name="exp-date"], input[placeholder*="MM / YY"], input[aria-label*="expiration"]');
        const cvcInput = frame.locator('input[name="cvc"], input[placeholder*="CVC"], input[aria-label*="security code"]');

        await expect(cardNumberInput).toBeVisible({ timeout: 10000 });

        // Fill the test card details
        await cardNumberInput.fill(STRIPE_TEST_CARD.number);
        await expiryInput.fill(STRIPE_TEST_CARD.expiry);
        await cvcInput.fill(STRIPE_TEST_CARD.cvc);
    }

    async submitPayment() {
        // The pay button might be inside or outside the iframe depending on Stripe Checkout vs Elements
        // We'll try both strategies
        const payButton = this.page.getByRole("button", { name: /pay|submit/i });
        await expect(payButton).toBeVisible({ timeout: 10000 });
        await payButton.click();

        // Wait for the network request to complete and redirect to start
        await this.page.waitForLoadState("networkidle");
    }

    async verifySuccess() {
        // Assert redirection to the success page
        await expect(this.page).toHaveURL(/.*\/success.*/);

        // Assert the confirmation text is visible
        const confirmationText = this.page.getByText(/ticket confirmed|payment successful/i);
        await expect(confirmationText).toBeVisible({ timeout: 10000 });
    }
}
