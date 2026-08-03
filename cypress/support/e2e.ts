// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Mock Supabase auth to simulate a logged-in user
Cypress.Commands.add("mockAuth", () => {
  window.localStorage.setItem(
    "sb-ynhpevfxvtmpfosiclxe-auth-token",
    JSON.stringify({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_at: Date.now() + 3600000,
      user: {
        id: "mock-user-id",
        email: "test@campusconnect.edu",
        user_metadata: { full_name: "Test User" },
      },
    }),
  );
});

Cypress.Commands.add("mockUnauth", () => {
  window.localStorage.removeItem("sb-ynhpevfxvtmpfosiclxe-auth-token");
});

Cypress.Commands.add("mockEvents", () => {
  cy.intercept("GET", "**/rest/v1/events*", {
    statusCode: 200,
    body: [
      {
        id: "mock-event-1",
        title: "Test Hackathon 2024",
        description: "A great hackathon event",
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        location: "Main Auditorium, PW IOI Pune",
        banner_url: null,
        created_by: "other-user-id",
        max_attendees: null,
        clubs: [{ name: "Tech Club", slug: "tech-club" }],
        event_rsvps: [],
        event_waitlist: [],
      },
    ],
  }).as("getEvents");

  cy.intercept("GET", "**/rest/v1/events?id=eq.mock-event-1*", {
    statusCode: 200,
    body: {
      id: "mock-event-1",
      title: "Test Hackathon 2024",
      description: "A great hackathon event for testing RSVP flow",
      event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      location: "Main Auditorium, PW IOI Pune",
      banner_url: null,
      created_by: "other-user-id",
      max_attendees: null,
      clubs: [{ name: "Tech Club", slug: "tech-club" }],
      event_rsvps: [],
      event_waitlist: [],
    },
  }).as("getEvent");

  cy.intercept("POST", "**/functions/v1/toggle-rsvp", {
    statusCode: 200,
    body: { success: true },
  }).as("toggleRsvp");
});
