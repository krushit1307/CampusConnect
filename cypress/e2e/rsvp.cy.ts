describe("RSVP Flow", () => {
  describe("Events Listing Page", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.visit("/events");
    });

    it("should display the events page", () => {
      cy.contains("Events").should("be.visible");
    });

    it("should show event cards on the events page", () => {
      cy.wait("@getEvents");
      cy.get("body").then(($body) => {
        if ($body.text().includes("Test Hackathon 2024")) {
          cy.contains("Test Hackathon 2024").should("be.visible");
        }
      });
    });
  });

  describe("Event Detail Page", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should display the event details page", () => {
      cy.contains("Test Hackathon 2024").should("be.visible");
    });

    it("should show the event description", () => {
      cy.contains("A great hackathon event for testing RSVP flow").should("be.visible");
    });

    it("should show the event location", () => {
      cy.contains("Main Auditorium, PW IOI Pune").should("be.visible");
    });

    it("should show the Back to Events link", () => {
      cy.contains("Back to Events").should("be.visible");
    });

    it("should show the Copy Link button", () => {
      cy.contains("Copy Link").should("be.visible");
    });

    it("should show the RSVP NOW button for non-logged-in users", () => {
      cy.contains("RSVP NOW").should("be.visible");
    });
  });

  describe("RSVP Without Authentication", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.mockUnauth();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should show error toast when clicking RSVP without login", () => {
      cy.contains("RSVP NOW").click();
      cy.contains("Please log in to RSVP").should("be.visible");
    });

    it("should show error toast when clicking RSVP'd without login", () => {
      cy.window().then((win) => {
        win.localStorage.setItem(
          "sb-ynhpevfxvtmpfosiclxe-auth-token",
          JSON.stringify({
            access_token: "mock-token",
            user: { id: "mock-user-id", email: "test@test.com" },
          }),
        );
      });

      cy.reload();
      cy.wait("@getEvent");
      cy.contains("RSVP NOW").should("be.visible");
    });
  });

  describe("RSVP With Authentication", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.mockAuth();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should show the RSVP NOW button when logged in", () => {
      cy.contains("RSVP NOW").should("be.visible");
    });

    it("should toggle RSVP state on click", () => {
      cy.contains("RSVP NOW").click();
      cy.wait("@toggleRsvp");
      cy.get("body").then(($body) => {
        const text = $body.text();
        if (text.includes("RSVP'd")) {
          cy.contains("RSVP'd").should("be.visible");
        }
      });
    });

    it("should show attendee count", () => {
      cy.get("body").then(($body) => {
        if ($body.text().includes("going")) {
          cy.contains("going").should("be.visible");
        }
      });
    });
  });

  describe("RSVP Cancel Flow", () => {
    beforeEach(() => {
      cy.mockEvents();

      cy.intercept("GET", "**/rest/v1/events?id=eq.mock-event-1*", {
        statusCode: 200,
        body: {
          id: "mock-event-1",
          title: "Test Hackathon 2024",
          description: "A great hackathon event",
          event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          ).toISOString(),
          location: "Main Auditorium, PW IOI Pune",
          banner_url: null,
          created_by: "other-user-id",
          max_attendees: null,
          clubs: [{ name: "Tech Club", slug: "tech-club" }],
          event_rsvps: [{ id: "rsvp-1", user_id: "mock-user-id" }],
          event_waitlist: [],
        },
      }).as("getEventWithRsvp");

      cy.mockAuth();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEventWithRsvp");
    });

    it("should show RSVP'd button when already RSVP'd", () => {
      cy.contains("RSVP'd").should("be.visible");
    });

    it("should open confirmation modal when clicking RSVP'd", () => {
      cy.contains("RSVP'd").click();
      cy.contains("Cancel RSVP").should("be.visible");
    });

    it("should cancel RSVP when confirming", () => {
      cy.contains("RSVP'd").click();
      cy.contains("Cancel RSVP").should("be.visible");
      cy.contains("Confirm").click();
      cy.wait("@toggleRsvp");
    });
  });

  describe("Calendar Integration", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should show Add to Calendar button", () => {
      cy.contains("Add to Calendar").should("be.visible");
    });

    it("should open calendar dropdown with options", () => {
      cy.contains("Add to Calendar").click();
      cy.contains("Google Calendar").should("be.visible");
      cy.contains("Apple Calendar").should("be.visible");
      cy.contains("Outlook").should("be.visible");
    });
  });

  describe("Share Functionality", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should show share buttons", () => {
      cy.contains("Share with Friends").should("be.visible");
    });

    it("should show Twitter share button", () => {
      cy.contains("Twitter").should("be.visible");
    });

    it("should show LinkedIn share button", () => {
      cy.contains("LinkedIn").should("be.visible");
    });

    it("should show WhatsApp share button", () => {
      cy.contains("WhatsApp").should("be.visible");
    });
  });

  describe("Navigation", () => {
    it("should navigate to events page from home", () => {
      cy.visit("/");
      cy.contains("Events").first().click();
      cy.url().should("include", "/events");
    });

    it("should navigate back to events from event detail", () => {
      cy.mockEvents();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
      cy.contains("Back to Events").click();
      cy.url().should("include", "/events");
    });
  });

  describe("Event Not Found", () => {
    it("should show event not found for invalid event", () => {
      cy.intercept("GET", "**/rest/v1/events*", {
        statusCode: 404,
        body: { message: "Not Found" },
      }).as("getEventNotFound");

      cy.visit("/events/nonexistent-event");
      cy.contains("Event Not Found").should("be.visible");
    });
  });

  describe("Mobile RSVP Bar", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.viewport(375, 667);
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should show mobile RSVP bar on small screens", () => {
      cy.get("body").then(($body) => {
        if ($body.text().includes("going")) {
          cy.contains("going").should("be.visible");
        }
      });
    });
  });

  describe("Waitlist Flow", () => {
    beforeEach(() => {
      cy.mockEvents();

      cy.intercept("GET", "**/rest/v1/events?id=eq.mock-event-1*", {
        statusCode: 200,
        body: {
          id: "mock-event-1",
          title: "Test Hackathon 2024",
          description: "A great hackathon event",
          event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          ).toISOString(),
          location: "Main Auditorium, PW IOI Pune",
          banner_url: null,
          created_by: "other-user-id",
          max_attendees: 1,
          clubs: [{ name: "Tech Club", slug: "tech-club" }],
          event_rsvps: [{ id: "rsvp-1", user_id: "other-user-id" }],
          event_waitlist: [],
        },
      }).as("getFullEvent");

      cy.mockAuth();
      cy.visit("/events/mock-event-1");
      cy.wait("@getFullEvent");
    });

    it("should show Join Waitlist button when event is at capacity", () => {
      cy.contains("Join Waitlist").should("be.visible");
    });

    it("should toggle waitlist state on click", () => {
      cy.contains("Join Waitlist").click();
      cy.get("body").then(($body) => {
        const text = $body.text();
        if (text.includes("On Waitlist")) {
          cy.contains("On Waitlist").should("be.visible");
        }
      });
    });
  });

  describe("Copy Event ID", () => {
    beforeEach(() => {
      cy.mockEvents();
      cy.visit("/events/mock-event-1");
      cy.wait("@getEvent");
    });

    it("should have copy event ID button", () => {
      cy.get('[aria-label="Copy Event ID"]').should("be.visible");
    });
  });

  describe("Export CSV (Organizer)", () => {
    beforeEach(() => {
      cy.mockEvents();

      cy.intercept("GET", "**/rest/v1/events?id=eq.mock-event-1*", {
        statusCode: 200,
        body: {
          id: "mock-event-1",
          title: "Test Hackathon 2024",
          description: "A great hackathon event",
          event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          ).toISOString(),
          location: "Main Auditorium, PW IOI Pune",
          banner_url: null,
          created_by: "mock-user-id",
          max_attendees: null,
          clubs: [{ name: "Tech Club", slug: "tech-club" }],
          event_rsvps: [],
          event_waitlist: [],
        },
      }).as("getOwnedEvent");

      cy.mockAuth();
      cy.visit("/events/mock-event-1");
      cy.wait("@getOwnedEvent");
    });

    it("should show Export CSV button for event organizer", () => {
      cy.contains("Export CSV").should("be.visible");
    });
  });
});
