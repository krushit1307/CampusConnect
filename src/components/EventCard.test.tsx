import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { EventCard } from "@/components/ui/EventCard";

const mockEvent = {
  id: "test-event-1",
  title: "React Compound Components Workshop",
  description:
    "Learn how to build reusable and modular components using React context and compound patterns.",
  tldr_summary: "Build reusable React components with hands-on patterns.",
  event_date: "2026-08-15T10:00:00Z",
  start_date: "2026-08-15T10:00:00Z",
  end_date: "2026-08-15T12:00:00Z",
  location: "Auditorium A",
  banner_url: null,
  created_at: "2026-07-01T00:00:00Z",
  clubs: { name: "Web Dev Club" },
  event_rsvps: [],
  saved_events: [],
};

const mockUser = { id: "user-123" };

describe("EventCard Compound Component", () => {
  it("renders with default children when no children are explicitly passed", () => {
    render(
      <BrowserRouter>
        <EventCard
          event={mockEvent}
          index={0}
          user={mockUser}
          onRsvpToggle={vi.fn()}
          isRsvpPending={false}
          onBookmarkToggle={vi.fn()}
          isBookmarkPending={false}
        />
      </BrowserRouter>,
    );

    expect(screen.getByText("React Compound Components Workshop")).toBeInTheDocument();
    expect(screen.getByText("Web Dev Club")).toBeInTheDocument();
    expect(
      screen.getByText("Build reusable React components with hands-on patterns."),
    ).toBeInTheDocument();
    expect(screen.getByText("Auditorium A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rsvp/i })).toBeInTheDocument();
  });

  it("renders custom compound component layout using EventCard sub-components", () => {
    render(
      <BrowserRouter>
        <EventCard
          event={mockEvent}
          index={1}
          user={mockUser}
          onRsvpToggle={vi.fn()}
          isRsvpPending={false}
          onBookmarkToggle={vi.fn()}
          isBookmarkPending={false}
        >
          <EventCard.Header />
          <EventCard.Body />
          <EventCard.Actions />
        </EventCard>
      </BrowserRouter>,
    );

    expect(screen.getByText("React Compound Components Workshop")).toBeInTheDocument();
    expect(screen.getByText("Web Dev Club")).toBeInTheDocument();
  });

  it("triggers bookmark callback when bookmark button is clicked", () => {
    const onBookmarkToggle = vi.fn();

    render(
      <BrowserRouter>
        <EventCard
          event={mockEvent}
          index={0}
          user={mockUser}
          onRsvpToggle={vi.fn()}
          isRsvpPending={false}
          onBookmarkToggle={onBookmarkToggle}
          isBookmarkPending={false}
        >
          <EventCard.Header />
        </EventCard>
      </BrowserRouter>,
    );

    const bookmarkButton = screen.getByRole("button", { name: /save event/i });
    fireEvent.click(bookmarkButton);

    expect(onBookmarkToggle).toHaveBeenCalledWith("test-event-1", false);
  });
});
