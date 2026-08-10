import { test, expect } from "./analytics-fixture";
import {
  isRealMode,
  installAuthApiMocks,
  installTurnstileMock,
  TEST_ACCOUNTS,
  TEST_PASSWORD,
} from "./auth-helpers";

const MOCK_ONLY_NOTE = "Requires AUTH_E2E_MODE=mock (default)";
const REAL_ONLY_NOTE = "Requires AUTH_E2E_MODE=real and a local Supabase instance";

test.describe("Authentication — sign in", () => {
  test("shows validation errors for empty and malformed credentials", async ({ page }) => {
    await page.goto("/auth");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await page.getByLabel("College email").fill("not-an-email");
    await page.getByLabel("Password").fill("secret");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
  });

  test("shows a friendly error when credentials are invalid", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { login: "invalid-credentials" });
    await page.goto("/auth");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "The email or password you entered is incorrect.",
    );
  });

  test("shows an account-locked message when login is throttled (429)", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { login: "locked" });
    await page.goto("/auth");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNTS.STUDENT.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText("Account locked, try again in 15 minutes");
  });

  test("surfaces a backend failure instead of crashing", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { login: "server-error" });
    await page.goto("/auth");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNTS.STUDENT.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.");
  });

  test("signs in successfully and redirects to the dashboard", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { login: "success" });
    await page.goto("/auth");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNTS.STUDENT.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("signs in with a seeded local account against a live backend", async ({ page }) => {
    test.skip(!isRealMode, REAL_ONLY_NOTE);
    await page.goto("/auth");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNTS.STUDENT.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});

test.describe("Authentication — sign up", () => {
  test.beforeEach(async ({ page }) => {
    // The sign-up submit button stays disabled until the CAPTCHA resolves,
    // so stub the Turnstile widget for every sign-up test.
    await installTurnstileMock(page);
  });

  test("shows validation errors for incomplete fields", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Last name is required.")).toBeVisible();
    await expect(page.getByText("Email is required.")).toBeVisible();
  });

  test("shows a validation error for an invalid email address", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("College email").fill("not-an-email");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
  });

  test("rejects mismatched passwords", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("College email").fill("ada@college.edu");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill("Different1!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match.")).toBeVisible();
  });

  test("shows a friendly error when the email is already registered", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { signup: "already-registered" });
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create an account" }).click();

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "An account with this email address already exists.",
    );
  });

  test("creates an account and completes the flow", async ({ page }) => {
    await installAuthApiMocks(page, { signup: "success" });
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create an account" }).click();

    const uniqueEmail = `e2e.${Date.now()}@campusconnect.test`;
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("College email").fill(uniqueEmail);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    if (isRealMode) {
      // With a real backend the confirmation email may or may not be required;
      // the "account created" toast is the deterministic signal in either case.
      await expect(
        page.getByText("Account created! A verification link has been sent to your email."),
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    }
  });
});

test.describe("Authentication — forgot password", () => {
  test("forgot-password link navigates from the sign-in page", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("link", { name: "Forgot password?" }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  test("shows a validation error for an invalid email", async ({ page }) => {
    await page.goto("/forgot-password");

    await page.getByLabel("College email").fill("not-an-email");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
  });

  test("shows a validation error when the email is empty", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
  });

  test("sends a reset link and shows the confirmation panel", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { passwordReset: "success" });
    await page.goto("/forgot-password");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  });

  test("does not leak whether an email is registered (anti-enumeration)", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { passwordReset: "success" });
    await page.goto("/forgot-password");

    await page.getByLabel("College email").fill("no-such-account@campusconnect.test");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  });

  test("surfaces a backend failure on the forgot-password page", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { passwordReset: "server-error" });
    await page.goto("/forgot-password");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("alert")).toContainText("Something went wrong. Please try again.");
  });

  test("navigates back to sign-in from the confirmation panel", async ({ page }) => {
    test.skip(isRealMode, MOCK_ONLY_NOTE);
    await installAuthApiMocks(page, { passwordReset: "success" });
    await page.goto("/forgot-password");

    await page.getByLabel("College email").fill(TEST_ACCOUNTS.STUDENT.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
