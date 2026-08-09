/// <reference types="cypress" />

/**
 * Type declarations for custom Cypress commands defined in cypress/support/e2e.ts.
 * These extend the Cypress Chainable interface so TypeScript recognises the
 * custom commands used in E2E test files.
 */
declare namespace Cypress {
  interface Chainable<Subject = unknown> {
    /**
     * Seed a mock Supabase auth token into localStorage so the app
     * behaves as if a user is logged in.
     */
    mockAuth(): void;

    /**
     * Remove any mock Supabase auth token from localStorage so the
     * app behaves as if no user is authenticated.
     */
    mockUnauth(): void;

    /**
     * Intercept the Supabase REST event endpoints and stub responses
     * with predictable fixture data for testing the RSVP flow.
     */
    mockEvents(): void;
  }
}
