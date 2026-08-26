// src/components/__tests__/EventSubmissions.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventSubmissions } from "../EventSubmissions";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-123" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
  }),
}));

describe("EventSubmissions Component", () => {
  it("renders competition file drop header", async () => {
    render(<EventSubmissions eventId="event-123" userRsvp={true} />);

    expect(await screen.findByText(/Competition File Drop/i)).toBeInTheDocument();
  });

  it("displays RSVP warning if user has not RSVP'd", async () => {
    render(<EventSubmissions eventId="event-123" userRsvp={false} />);

    expect(
      await screen.findByText(/You must RSVP for this event before you can submit competition files/i)
    ).toBeInTheDocument();
  });

  it("displays deadline closed badge if deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 3600000).toISOString();

    render(
      <EventSubmissions
        eventId="event-123"
        submissionDeadline={pastDeadline}
        userRsvp={true}
      />
    );

    expect(await screen.findByText(/Submissions Closed/i)).toBeInTheDocument();
  });

  it("displays organizer dashboard controls when isOrganizer is true", async () => {
    render(<EventSubmissions eventId="event-123" userRsvp={true} isOrganizer={true} />);

    expect(
      await screen.findByText(/Organizer Dashboard: Submissions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Download All Submissions \(\.ZIP\)/i)
    ).toBeInTheDocument();
  });
});
