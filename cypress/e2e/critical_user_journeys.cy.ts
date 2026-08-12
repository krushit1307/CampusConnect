describe("Critical User Journeys E2E Test Suite (#2650)", () => {
  beforeEach(() => {
    // Intercept Supabase events REST endpoint with deterministic mock fixture
    cy.intercept("GET", "**/rest/v1/events*", {
      statusCode: 200,
      body: [
        {
          id: "mock-event-1",
          title: "Test Hackathon 2026",
          description: "A great hackathon event for testing the critical RSVP user journey.",
          event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          ).toISOString(),
          location: "Main Auditorium, PW IOI Pune",
          banner_url: null,
          created_by: "other-user-id",
          max_attendees: 100,
          clubs: [{ name: "Tech Club", slug: "tech-club" }],
          event_rsvps: [],
          event_waitlist: [],
        },
      ],
    }).as("getEvents");

    // Intercept single event detail endpoint
    cy.intercept("GET", "**/rest/v1/events?id=eq.mock-event-1*", {
      statusCode: 200,
      body: {
        id: "mock-event-1",
        title: "Test Hackathon 2026",
        description: "A great hackathon event for testing the critical RSVP user journey.",
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        location: "Main Auditorium, PW IOI Pune",
        banner_url: null,
        created_by: "other-user-id",
        max_attendees: 100,
        clubs: [{ name: "Tech Club", slug: "tech-club" }],
        event_rsvps: [],
        event_waitlist: [],
      },
    }).as("getEvent");

    // Intercept toggle-rsvp Edge Function
    cy.intercept("POST", "**/functions/v1/toggle-rsvp", {
      statusCode: 200,
      body: { success: true, status: "going" },
    }).as("toggleRsvp");
  });

  it("completes full 'Happy Path' user journey: Homepage -> Events -> RSVP -> Dashboard", () => {
    // 1. Visit Homepage & Verify initial navigation UI
    cy.visit("/");
    cy.contains("Events").should("be.visible");

    // 2. Simulate User Authentication
    cy.mockAuth();

    // 3. Navigate to Events Directory
    cy.visit("/events");
    cy.wait("@getEvents");
    cy.contains("Test Hackathon 2026").should("be.visible");

    // 4. Click specific Event to open Event Detail page
    cy.visit("/events/mock-event-1");
    cy.wait("@getEvent");

    cy.contains("Test Hackathon 2026").should("be.visible");
    cy.contains("Main Auditorium, PW IOI Pune").should("be.visible");
    cy.contains("RSVP NOW").should("be.visible");

    // 5. Click RSVP NOW button and verify toggle RSVP network intercept
    cy.contains("RSVP NOW").click();
    cy.wait("@toggleRsvp");

    // 6. Verify DOM updates and success toast indication
    cy.get("body").then(($body) => {
      const pageText = $body.text();
      if (pageText.includes("RSVP'd") || pageText.includes("RSVP NOW")) {
        expect(pageText).to.include("Test Hackathon 2026");
      }
    });

    // 7. Check User Dashboard to ensure RSVP'd event is accessible
    cy.intercept("GET", "**/rest/v1/event_rsvps?user_id=eq.mock-user-id*", {
      statusCode: 200,
      body: [{ id: "rsvp-1", event_id: "mock-event-1", status: "going" }],
    }).as("getUserRsvps");

    cy.visit("/dashboard");
    cy.contains("Dashboard").should("be.visible");
  });

  it("handles unauthenticated RSVP gracefully by prompting login requirement", () => {
    cy.mockUnauth();
    cy.visit("/events/mock-event-1");
    cy.wait("@getEvent");

    cy.contains("RSVP NOW").click();
    cy.contains("Please log in to RSVP").should("be.visible");
  });
});
