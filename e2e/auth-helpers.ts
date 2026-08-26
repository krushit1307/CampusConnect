/**
 * Shared helpers for the authentication E2E suite (e2e/auth.spec.ts).
 *
 * Two execution modes are supported, controlled by the AUTH_E2E_MODE
 * environment variable:
 *
 * - "mock" (default): every Supabase API call (edge functions, Auth REST,
 *   PostgREST) is intercepted and answered with a deterministic fixture.
 *   Tests never touch a real database, so they are safe to run in CI and
 *   locally without a Supabase backend. This satisfies the "avoid polluting
 *   production" requirement by construction.
 * - "real": nothing is intercepted. Point VITE_SUPABASE_URL at a local
 *   `supabase start` instance (or a dedicated staging project) and serve the
 *   auth edge functions:
 *     supabase start
 *     supabase functions serve login-proxy request-password-reset
 *   Seeded accounts from supabase/seed.sql are used for valid credentials.
 */

import type { Page, Route } from "@playwright/test";

export const AUTH_E2E_MODE = process.env.AUTH_E2E_MODE === "real" ? "real" : "mock";
export const isRealMode = AUTH_E2E_MODE === "real";

/** Accounts seeded by supabase/seed.sql (used in "real" mode). */
export const TEST_ACCOUNTS = {
  ADMIN: { email: "admin@campusconnect.com", password: "password123" },
  STUDENT: { email: "student@campusconnect.com", password: "password123" },
} as const;

/** Password that satisfies the sign-up strength rules (>=8 chars, letter, number). */
export const TEST_PASSWORD = "Str0ngPass1!";

/** Token our Turnstile widget mock reports back to the sign-up form. */
export const MOCK_CAPTCHA_TOKEN = "TEST_CAPTCHA_TOKEN";

export interface AuthMocks {
  login: "success" | "invalid-credentials" | "locked" | "server-error";
  signup: "success" | "already-registered" | "server-error";
  passwordReset: "success" | "server-error";
}

const DEFAULT_MOCKS: AuthMocks = {
  login: "success",
  signup: "success",
  passwordReset: "success",
};

export const MOCK_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "test.user@campusconnect.edu",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { first_name: "Test", last_name: "User", full_name: "Test User" },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const MOCK_SESSION = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: MOCK_USER,
};

function json(route: Route, status: number, payload: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

/**
 * Intercepts every Supabase API request (any host — local, staging or the
 * production project URL) and answers with deterministic fixtures based on
 * the `overrides`. All other requests (app assets, images, etc.) continue
 * normally.
 */
export async function installAuthApiMocks(
  page: Page,
  overrides: Partial<AuthMocks> = {},
): Promise<void> {
  const mocks: AuthMocks = { ...DEFAULT_MOCKS, ...overrides };

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.startsWith("/functions/v1/")) {
      if (url.pathname.includes("/login-proxy")) {
        if (mocks.login === "invalid-credentials") {
          await json(route, 400, { error: "Invalid login credentials" });
          return;
        }
        if (mocks.login === "locked") {
          await json(route, 429, {
            error: "Too many requests. Please try again later.",
            retryAfter: 900,
          });
          return;
        }
        if (mocks.login === "server-error") {
          await json(route, 500, { error: "Something went wrong. Please try again." });
          return;
        }
        await json(route, 200, { session: MOCK_SESSION, user: MOCK_USER });
        return;
      }

      if (url.pathname.includes("/request-password-reset")) {
        if (mocks.passwordReset === "server-error") {
          await json(route, 500, { error: "Something went wrong. Please try again." });
          return;
        }
        await json(route, 200, { message: "If this email exists, a reset link has been sent." });
        return;
      }

      await json(route, 200, {});
      return;
    }

    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.includes("/token") && route.request().method() === "POST") {
        await json(route, 200, MOCK_SESSION);
        return;
      }
      if (url.pathname.includes("/signup") && route.request().method() === "POST") {
        if (mocks.signup === "already-registered") {
          await json(route, 400, {
            error_code: "user_already_exists",
            msg: "User already registered",
          });
          return;
        }
        if (mocks.signup === "server-error") {
          await json(route, 500, { error: "Something went wrong. Please try again." });
          return;
        }
        await json(route, 200, MOCK_SESSION);
        return;
      }
      if (url.pathname.includes("/attributes")) {
        await json(route, 200, {
          currentLevel: "aal1",
          nextLevel: null,
          currentAuthenticationMethods: [],
        });
        return;
      }
      if (url.pathname.includes("/factors")) {
        await json(route, 200, { all: [], totp: [], phone: [] });
        return;
      }
      if (url.pathname.includes("/user")) {
        await json(route, 200, { user: MOCK_USER });
        return;
      }
      await json(route, 200, { data: null, error: null });
      return;
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      await json(route, 200, []);
      return;
    }

    await route.continue();
  });
}

/**
 * Stubs the Cloudflare Turnstile widget (client-side only) so the sign-up
 * form's CAPTCHA requirement can be satisfied deterministically in tests.
 * The widget mock is harmless in "real" mode: it only simulates the widget
 * completing, never touches the backend.
 */
export async function installTurnstileMock(page: Page): Promise<void> {
  await page.addInitScript((token) => {
    (window as unknown as { turnstile?: Record<string, unknown> }).turnstile = {
      render: (_element: unknown, opts?: { callback?: (t: string) => void }) => {
        if (opts?.callback) {
          window.setTimeout(() => opts.callback!(token), 10);
        }
        return "test-widget-id";
      },
      reset: () => {},
      remove: () => {},
      execute: () => {},
    };
  }, MOCK_CAPTCHA_TOKEN);

  await page.route("**/challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.turnstile = window.turnstile || {};",
    }),
  );
}
