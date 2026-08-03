# Playwright E2E Tests: Stripe Checkout

This directory contains End-to-End tests for the Stripe checkout flow.

## Prerequisites

1. Ensure you have installed Playwright browsers:
   ```bash
   npx playwright install
   ```
2. The application must be running in a Staging environment connected to Stripe Test Mode.
3. Set the BASE_URL environment variable if testing against a remote staging server:
   ```bash
   export BASE_URL="https://staging.campusconnect.com"
   ```


## Running the Tests

### Headed Mode (Watch the browser)
To visually verify that the robot types the `4242` credit card into the Stripe form:
```bash
npx playwright test checkout.spec.ts --headed
```

### Headless Mode (CI/CD)
```bash
npx playwright test checkout.spec.ts
```

### Generate HTML Report
```bash
npx playwright show-report
```


## Test Coverage
✅ Successful purchase with valid test card (4242 4242 4242 4242).
✅ Graceful handling of declined cards (4000 0000 0000 0002).
✅ Verification of /success URL redirection.
✅ Verification of "Ticket Confirmed" text visibility.