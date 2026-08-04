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

---

# Authentication E2E Tests (e2e/auth.spec.ts)

Comprehensive end-to-end coverage of the authentication flows: sign in, sign up,
and forgot password.

## Running

Auth tests are included in the full suite:

```bash
npm run test:e2e
```

or run just the auth suite:

```bash
npx playwright test auth.spec.ts --project=chromium
```

### Prerequisites

1. Install Playwright browsers: `npx playwright install`
2. Create a `.env.local` with valid Supabase values (the client validates these
   on boot). In "mock" mode the values are never actually used, but they must be
   a valid URL and non-empty:

   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=test-anon-key
   VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   ```

   The Turnstile key must be non-empty so the widget renders (the tests stub
   the widget itself, so any value works). `1x00000000000000000000AA` is
   Cloudflare's always-passing test key.

## Execution Modes

### Mock mode (default) — hermetic, CI-safe

Every Supabase API call (edge functions, Auth REST, PostgREST) is intercepted
via `page.route` and answered with deterministic fixtures. No request ever
reaches a real database, so tests never pollute production. This is the mode
used by the CI workflow (`.github/workflows/e2e-auth.yml`).

### Real mode — against a local Supabase instance

```bash
AUTH_E2E_MODE=real npm run test:e2e
```

or

```bash
AUTH_E2E_MODE=real npx playwright test auth.spec.ts --project=chromium
```

With this mode nothing is mocked. Start a local Supabase stack and serve the
auth edge functions, then point `VITE_SUPABASE_URL` at it:

```bash
supabase start
supabase functions serve login-proxy request-password-reset
```

Valid credentials come from the seeded accounts in `supabase/seed.sql`
(e.g. `student@campusconnect.com` / `password123`). The Turnstile widget is
still stubbed client-side so the sign-up form can complete.

## Coverage

- ✅ Sign-in form validation (empty fields, malformed email)
- ✅ Invalid credentials show a friendly error
- ✅ Account-locked message when login is throttled (429)
- ✅ Successful sign-in redirects to the dashboard
- ✅ Sign-up form validation (incomplete fields, invalid email, mismatched passwords)
- ✅ Duplicate-email sign-up shows a friendly error
- ✅ Successful sign-up completes the flow
- ✅ Forgot-password navigation, validation, success panel, and anti-enumeration
- ✅ Backend failures surface as friendly alerts instead of crashes
