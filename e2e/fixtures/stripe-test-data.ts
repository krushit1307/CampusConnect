/**
 * Stripe Test Data Fixtures
 * Provides official Stripe test card details and helper functions for E2E testing.
 * @see https://stripe.com/docs/testing#cards
 */

export const STRIPE_TEST_CARD = {
  number: "4242 4242 4242 4242",
  expiry: "12/34", // Any future date
  cvc: "123", // Any 3 digits
  zip: "12345", // Optional, but good for completeness
};

export const TEST_EVENT_DETAILS = {
  title: "Test Event for Checkout",
  price: "$10.00",
  slug: "test-event-checkout",
};

/**
 * Generates a unique test user email to prevent collision across test runs.
 */
export const generateTestEmail = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test.checkout.${timestamp}.${random}@example.com`;
};

/**
 * Waits for the Stripe iframe to be fully loaded and ready for input.
 * Stripe uses dynamic iframe names, so we target by title or role.
 */
export const waitForStripeFrame = async (page: any) => {
  await page.waitForLoadState("networkidle");
  // Stripe iframes typically have titles like "Secure payment input frame"
  return page.frameLocator('iframe[title*="Secure payment"], iframe[name^="__privateStripeFrame"]');
};
